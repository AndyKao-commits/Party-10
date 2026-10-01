import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HostPage, JoinPage } from './pages/Home'
import { ActivityPage } from './pages/Activity'
import { AreaPage, QtyPage, QueuePage } from './pages/BuyFlow'
import { CheckoutPage, SuccessPage } from './pages/Checkout'
import {
  CatalogHome,
  FakeActivityPage,
  NewsPage,
  OrdersPage,
  SearchPage,
} from './pages/Catalog'
import './styles/global.css'
import './styles/pages.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CatalogHome />} />
        <Route path="/ActivityInfo/Details/:slug" element={<FakeActivityPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/r/:code" element={<ActivityPage />} />
        <Route path="/r/:code/queue" element={<QueuePage />} />
        <Route path="/r/:code/area" element={<AreaPage />} />
        <Route path="/r/:code/qty" element={<QtyPage />} />
        <Route path="/r/:code/checkout" element={<CheckoutPage />} />
        <Route path="/r/:code/success" element={<SuccessPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
