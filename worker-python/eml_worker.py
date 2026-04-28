from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import cmath
from typing import Union

app = FastAPI()


class ComplexNumber(BaseModel):
    re: float
    im: float = 0.0


ComplexOrReal = Union[ComplexNumber, float]


class EMLRequest(BaseModel):
    x: ComplexOrReal
    y: ComplexOrReal


def _to_complex(v: ComplexOrReal) -> complex:
    if isinstance(v, ComplexNumber):
        return complex(v.re, v.im)
    return complex(float(v), 0.0)


@app.post("/eml")
def compute_eml(payload: EMLRequest):
    x = _to_complex(payload.x)
    y = _to_complex(payload.y)
    if y == 0:
        raise HTTPException(status_code=400, detail="ln(0) undefined")
    try:
        exp_x = cmath.exp(x)
        log_y = cmath.log(y)
        result = exp_x - log_y
        if (not (result.real == result.real)) or (not (result.imag == result.imag)):
            raise OverflowError("result is NaN")
        if abs(result.real) == float("inf") or abs(result.imag) == float("inf"):
            raise OverflowError("result is infinite")
        return {"result": {"re": result.real, "im": result.imag}}
    except OverflowError as oe:
        raise HTTPException(status_code=400, detail=f"math overflow: {oe}")
    except ValueError as ve:
        # math domain errors
        raise HTTPException(status_code=400, detail=str(ve))
    except ZeroDivisionError as zde:
        raise HTTPException(status_code=400, detail=str(zde))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Run: uvicorn eml_worker:app --port 5000