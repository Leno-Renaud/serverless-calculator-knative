import './ResultKey.css'
import { calculate } from '../../Api/calculator.api.js'

export default function ResultKey(props) {
  async function calculateResult(){
    try{
      const data = await calculate(props.expression)
      props.show(data.result)
    }
    catch(error){
      props.show('Error')
      throw error
    }
  }
  return (
    <button className="resultKey" onClick={calculateResult}>=</button>
  )
}