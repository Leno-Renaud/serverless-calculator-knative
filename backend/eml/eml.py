#!/usr/bin/env python3
from flask import Flask, request, jsonify
from math import exp, log
import os

app = Flask(__name__)


def eml(x, y):
    return exp(x) - log(y)

@app.route('/eml', methods=['POST'])
def calculate():
    data = request.get_json()
    if 'a' not in data or 'b' not in data:
        return jsonify({'error': "Champs 'a' et 'b' requis"}), 400
    try:
        x = float(data['a'])
        y = float(data['b'])

        if y <= 0:
            return jsonify({'error': "'b' doit être strictement positif"}), 400

        result = eml(x, y)
        return jsonify({'result': result})
    
    except (TypeError, ValueError):
        return jsonify({'error': "'a' et 'b' doivent être numériques"}), 400

if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 10000))
    app.run(host='0.0.0.0', port=port)