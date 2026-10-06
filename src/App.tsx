import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { JoinPage } from './pages/Home'
import { ActivityPage } from './pages/Activity'
import { PrankPage } from './pages/Prank'
import { AdminPage } from './pages/Admin'
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
import './styles/ticket.css'
import { AccessProvider, RequireMember, SiteGate } from './lib/access'
import { AccountPage } from './pages/Account'

export default function App() {
  return (
    <BrowserRouter>
      <AccessProvider><SiteGate><Routes>
        <Route path="/" element={<CatalogHome />} />
        <Route path="/ActivityInfo/Details/:slug" element={<FakeActivityPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/prank" element={<PrankPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/host" element={<Navigate to="/admin" replace />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/r/:code" element={<ActivityPage />} />
        <Route path="/r/:code/queue" element={<RequireMember><QueuePage /></RequireMember>} />
        <Route path="/r/:code/area" element={<RequireMember><AreaPage /></RequireMember>} />
        <Route path="/r/:code/qty" element={<RequireMember><QtyPage /></RequireMember>} />
        <Route path="/r/:code/checkout" element={<RequireMember><CheckoutPage /></RequireMember>} />
        <Route path="/r/:code/success" element={<SuccessPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></SiteGate></AccessProvider>
    </BrowserRouter>
  )
}
