from flask import Flask, session, redirect, url_for, request, jsonify, render_template
from flask_session import Session
import flask
import httplib2
from logging import info as linfo
from celery import Celery
import json
import time
import sqlite3
import requests
db = sqlite3.connect('interjections.db', check_same_thread=False)
db.row_factory = sqlite3.Row
cursor = db.cursor()
openaustraliakey = "ASdfqKDUJuydFHTMUCGjY9QS"


production = False

app = flask.Flask(__name__)
SESSION_TYPE = 'filesystem'
app.config.from_object(__name__)
Session(app)

if production:
    app.config['CELERY_BROKER_URL'] = 'amqp://guest@localhost'
    app.config['CELERY_RESULT_BACKEND'] = 'amqp://guest@localhost'
else:
    app.config['CELERY_BROKER_URL'] = 'redis://localhost:6379/0'
    app.config['CELERY_RESULT_BACKEND'] = 'redis://localhost:6379/0'

celery = Celery(app.name, broker=app.config['CELERY_BROKER_URL'])
celery.conf.update(app.config)


@app.route('/show/<electorate>')
def show(electorate):
    db = sqlite3.connect('interjections.db', check_same_thread=False)
    db.row_factory = sqlite3.Row
    cursor = db.cursor()
    querystring = '''SELECT members.FirstName, members.Surname, members.Electorate, members.aphkey, 
                    interjections_summary.males_interrupted,interjections_summary.females_interrupted, interjections_summary.percent_female,interjections_summary.percent_male,interjections_summary.total
                    FROM members
                    INNER JOIN interjections_summary on members.aphkey = interjections_summary.aphkey
                    WHERE members.Electorate = "{}";'''.format(electorate)
    result = cursor.execute(querystring).fetchone()
    member = dict(result)
    return render_template("mp.html", member=member)


@app.route('/findmp', methods=['POST', 'GET'])
def findmp():
    requeststring = "http://www.openaustralia.org/api/getRepresentatives?postcode={}&key={}".format(
        request.form['postcode'], openaustraliakey)
    mps = requests.get(requeststring).json()
    return render_template("choosemp.html", mps=mps)


@app.route('/worst')
def worst():
    return


@app.route('/best')
def best():
    return


@app.route('/about')
def about():
    return


@app.route('/', methods=['POST', 'GET'])
def index():
    return render_template('index.html')


if __name__ == "__main__":
    app.secret_key = '98234rjajfnjqu2983rn9j'
    app.run(debug=True, port=5000, host="0.0.0.0")
