#!/usr/bin/env python3
import sys
import json
import cmath


def make_error(msg):
    return {"error": msg}


def eval_eml(node):
    if not isinstance(node, dict):
        raise ValueError('Nœud EML invalide')

    if node.get('isLeaf'):
        v = node.get('value')
        try:
            return complex(float(v), 0.0)
        except Exception:
            raise ValueError('Valeur feuille invalide')

    left = eval_eml(node.get('left'))
    right = eval_eml(node.get('right'))

    if abs(right.real) < 1e-15 and abs(right.imag) < 1e-15:
        raise ZeroDivisionError('Division par zéro')

    try:
        return cmath.exp(left) - cmath.log(right)
    except Exception:
        raise ValueError('Erreur de calcul EML')


def main():
    if len(sys.argv) < 2:
        print(json.dumps(make_error('EML manquant')), end='')
        sys.exit(1)

    eml_str = sys.argv[1]
    try:
        eml = json.loads(eml_str)
    except Exception:
        print(json.dumps(make_error('JSON EML invalide')) , end='')
        sys.exit(1)

    try:
        value = eval_eml(eml)
    except ZeroDivisionError as e:
        print(json.dumps(make_error(str(e))) , end='')
        sys.exit(1)
    except Exception as e:
        print(json.dumps(make_error(str(e))) , end='')
        sys.exit(1)

    if not (isinstance(value.real, float) or isinstance(value.real, int)):
        print(json.dumps(make_error('Résultat non numérique')) , end='')
        sys.exit(1)

    if abs(value.imag) >= 1e-10:
        print(json.dumps(make_error('Résultat complexe inattendu')) , end='')
        sys.exit(1)

    rounded = round(value.real, 12)
    if rounded == -0.0:
        rounded = 0.0

    print(json.dumps({"result": rounded}), end='')


if __name__ == '__main__':
    main()
