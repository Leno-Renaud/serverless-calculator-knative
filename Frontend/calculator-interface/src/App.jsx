import './App.css'
import Key from './Components/Key/Key.jsx'
import ResultKey from './Components/ResultKey/ResultKey.jsx'
import { useState } from 'react'


export default function App() {
  const [expression, setExpression] = useState("")
  const handleKeyPress = (value) => {
    if (value === "⌫") {
      setExpression("")
      return
    }
    setExpression((previous) => previous + value)
  }
  const displayResult = (result) => {
    setExpression(result)
    console.log("Calculation result:", result)
  }

  const numberKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"]
  const operationKeys = ["+", "-", "*", "/", "(", ")"]

  return (
    <div className="app">
      <div className="calculator">
        <input type="text" id="resultZone" placeholder="Enter a calculation" value={expression} onChange={(e) => setExpression(e.target.value)}/>
        <div className='keysWrapper'>
          <div className="numberKeys">
            {numberKeys.map((keyValue) => (
              <Key key={keyValue} value={keyValue} onPress={handleKeyPress} />
            ))}
          </div>
          <div className="operationWrapper">
            <div className='operationKeys'>
              {operationKeys.map((keyValue) => (
                <Key key={keyValue} value={keyValue} onPress={handleKeyPress} />
              ))}
            </div>
            <ResultKey show={displayResult} expression={expression} />
          </div>
        </div>
      </div>
    </div>
  )
}
