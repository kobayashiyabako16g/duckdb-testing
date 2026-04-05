import { Outlet } from "react-router";
import { Header } from "~/components/Header";
import { Provider } from "~/provider";

export default function Layout() {
  return (
    <Provider>
      <div className="container mx-auto p-4">
        <Header />
        <Outlet />
      </div>
    </Provider>
  );
}
