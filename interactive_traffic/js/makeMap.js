var baseMap = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw', {
  maxZoom: 18,
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
  id: 'mapbox.light'
});

var map = L.map('map', {
    center: [-6.1754, 106.8272],
    zoom: 12,
    layers: [baseMap]
});

  Papa.parse('../data/newtest.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function(results) {
      var geoJsonFeatureCollection = {
        type: 'FeatureCollection',
        features: results.data.map(function(datum) {
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [datum.from_lon, datum.from_lat]
            },
            properties: datum
          }
        })
      };

      var oneToManyFlowmapLayer = L.canvasFlowmapLayer(geoJsonFeatureCollection, {
        originAndDestinationFieldIds: {
          originUniqueIdField: 'from_id',
          originGeometry: {
            x: 'from_lon',
            y: 'from_lat'
          },
          destinationUniqueIdField: 'to_id',
          destinationGeometry: {
            x: 'to_lon',
            y: 'to_lat'
          }
        },
        onEachFeature: function (feature, layer) {
          layer.bindPopup('Halte ' + feature.properties.from)
        },
        pathDisplayMode: 'selection',
        animationStarted: true,
        animationEasingFamily: 'Cubic',
        animationEasingType: 'Out',
        animationDuration: 4000
      }).addTo(map);

      oneToManyFlowmapLayer.on('click', function(e) {
        if (e.sharedOriginFeatures.length) {
          oneToManyFlowmapLayer.selectFeaturesForPathDisplay(e.sharedOriginFeatures, 'SELECTION_NEW');
        }
        if (e.sharedDestinationFeatures.length) {
          oneToManyFlowmapLayer.selectFeaturesForPathDisplay(e.sharedDestinationFeatures, 'SELECTION_NEW');
        }
      });
      oneToManyFlowmapLayer.selectFeaturesForPathDisplayById('from_id', 83, true, 'SELECTION_NEW');
    }
  });
