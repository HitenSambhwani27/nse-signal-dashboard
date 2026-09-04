import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state">
      <h3>View not found</h3>
      <p>
        That route is not part of the terminal. Return to <Link href="/">overview</Link>.
      </p>
    </div>
  );
}
