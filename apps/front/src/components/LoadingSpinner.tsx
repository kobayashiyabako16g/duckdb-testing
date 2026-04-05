const defaultHint = "Loading...";

interface LoadingIndicatorProps {
  hint: string;
}

export default function LoadingSpinner({
  hint = defaultHint,
}: LoadingIndicatorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-32">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      <p className="mt-4 text-sm text-gray-600 text-center" aria-live="polite">
        {hint || defaultHint}
      </p>
    </div>
  );
}
