import './Key.css'

export default function Key(props) {
  return (
    <button className="key" onClick={() => props.onPress(props.value)}>{props.value}</button>
  )
}