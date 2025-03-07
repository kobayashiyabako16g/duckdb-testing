import { Link } from "react-router";

export function HomeApp() {
  // 各ページのリンクと説明
  // ul と li でリストを作成
  return (
    <main className="px-4">
      <h1 className="font-bold">Home</h1>
      <ul className="list-disc list-inside text-blue-400">
        <li>
          <Link to="/csv">CSV (field: id, first_name, last_name, email, ip_address)</Link>
        </li>
        <li>
          <Link to="/csv/nohead">CSV (no header)</Link>
        </li>
      </ul>
    </main>
  );
}
