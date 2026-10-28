import { BrowserRouter } from 'react-router-dom'
import './App.css'
import Footer from './component/footer'
import Navbar from './component/navbar'
import Index from './router'

function App() {


  return (
    <>
      <BrowserRouter>
      <Navbar/>
      <Index/>
      <Footer/>
      </BrowserRouter>
    </>
  )
}

export default App
