import { Link } from "@tanstack/react-router";

export function HomeApp() {
  return (
    <main className="px-4">
      <h1 className="font-bold">Home</h1>
      <ul className="list-disc list-inside text-blue-400">
        <li>
          <Link to="/csv/by-date">日付ビュー</Link>
        </li>
        <li>
          <Link to="/upload">アップロード</Link>
        </li>
      </ul>
    </main>
  );
}
