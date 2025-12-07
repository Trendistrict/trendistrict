import TodoDashboard from "@/components/TodoDashboard";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <TodoDashboard />
      </div>
    </div>
  );
}
