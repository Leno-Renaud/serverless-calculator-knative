#!/usr/bin/env python3
from flask import Flask, request, jsonify
from math import exp, log
import os

app = Flask(__name__)


def eml(x, y):
    return exp(x) - log(y)

@app.route('/eml', methods=['POST'])
def calculate():
    """Calcule eml(a, b) = exp(a) - log(b)"""
    data = request.get_json()
    if not data or 'a' not in data or 'b' not in data:
        return jsonify({'error': "Champs 'a' et 'b' requis"}), 400
    try:
        x = float(data['a'])
        y = float(data['b'])

        # Validation: log(y) n'existe que si y > 0
        if y <= 0:
            return jsonify({'error': "'b' doit être strictement positif (log impossible)"}), 400

        result = eml(x, y)
        
        # Vérifier que le résultat est fini
        if not isinstance(result, (int, float)) or result != result:  # NaN check
            return jsonify({'error': "Résultat invalide (NaN ou infini)"}), 500
        
        return jsonify({'result': result})
    
    except (TypeError, ValueError) as e:
        return jsonify({'error': f"'a' et 'b' doivent être numériques: {str(e)}"}), 400
    except Exception as e:
        return jsonify({'error': f"Erreur EML interne: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 10000))
    app.run(host='0.0.0.0', port=port)