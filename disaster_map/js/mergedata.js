// TODO with enough time:
// Replace the GeoJSON with Topojson + leaflet-omnivore
// Loop an array of endpoints, rather than just copy pasting the same bit of code three times
// Use the data in the endpoints to populate the popup menu (% Area affected etc)
// Better Colours
// Test responsive
// Put it in a page with some surrounding detail


// Add basemap
var baseMap = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
  maxZoom: 18,
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
  id: 'mapbox.light'
});

// Fetch GeoJSON and data to join to it
$.when(
  $.getJSON('https://raw.githubusercontent.com/pemiluAPI/pemilu-data/master/dapil/shapefiles/admin_kabupaten/geojson/KABUKOTA_ADMINISTRATIVE_AREA-SIMPLIFIED.geojson'),
  $.getJSON('http://139.59.230.55/frontend/api/maps/disaster'),
  $.getJSON('http://139.59.230.55/frontend/api/maps/vulnerable'),
  $.getJSON('http://139.59.230.55/frontend/api/maps/area')
).done(function (responseGeojson, responseDisaster, responseVulnerable, responseArea) {
    var disaster = responseDisaster[0]
    var vulnerable = responseVulnerable[0]
    var area = responseArea[0]
    var geojson = responseGeojson[0]

    function index_by_city(data) {
      return data.reduce(function (hash, item) {
        if (item.city_id) {
          hash[item.city_id] = isNaN(item.value) ? null : +item.value
        }
        return hash
      }, {})
    }

    function geojson_append_data(geojson, name, data) {
      var data_by_city = index_by_city(data)

      geojson.features.forEach(function (item) {
        item.properties[name] = data_by_city[item.properties.id_kabkota] || 0
      })
    }

    geojson_append_data(geojson, "disaster", disaster.data)
    geojson_append_data(geojson, "vulnerable", vulnerable.data)
    geojson_append_data(geojson, "area", area.data)

    var disasterMap = L.choropleth(geojson, {
      valueProperty: 'disaster',
      scale: ['white', 'red'],
      steps: 10,
      mode: 'q',
      style: {
        color: '#fff',
        weight: 2,
        fillOpacity: 0.6
      },
      onEachFeature: function (feature, layer) {
        layer.bindPopup('City ' + feature.properties.nm_kabkota + '<br>' + feature.properties.disaster.toLocaleString() + ' disasters')
      }
    });

    var vulnerableMap = L.choropleth(geojson, {
      valueProperty: 'vulnerable',
      scale: ['white', 'green'],
      steps: 10,
      mode: 'q',
      style: {
        color: '#fff',
        weight: 2,
        fillOpacity: 0.6
      },
      onEachFeature: function (feature, layer) {
        layer.bindPopup('City ' + feature.properties.nm_kabkota + '<br>' + feature.properties.vulnerable.toLocaleString() + ' % Vulnerable')
      }
    });

    var areaMap = L.choropleth(geojson, {
      valueProperty: 'area',
      scale: ['white', 'blue'],
      steps: 10,
      mode: 'q',
      style: {
        color: '#fff',
        weight: 2,
        fillOpacity: 0.6
      },
      onEachFeature: function (feature, layer) {
        layer.bindPopup('City ' + feature.properties.nm_kabkota + '<br>' + feature.properties.area.toLocaleString() + ' % Area affected')
      }
    });

    var map = L.map('map', {
        center: [-6.34,106.84],
        zoom: 5,
        layers: [baseMap, disasterMap]
    });

    var baseMaps = {
        "Base Map": baseMap
    };

    var overlays = {
        "Disasters": disasterMap,
        "Vulnerable %": vulnerableMap,
        "Area Affected": areaMap
    };

    L.control.layers(baseMaps, overlays,{collapsed:false}).addTo(map)
});
