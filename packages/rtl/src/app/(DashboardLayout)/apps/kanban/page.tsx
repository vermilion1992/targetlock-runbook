import TaskManager from "@/app/components/apps/kanban/TaskManager";
import BreadcrumbComp from "../../layout/shared/breadcrumb/BreadcrumbComp";
import { Card } from "@/components/ui/card";
import { KanbanDataContextProvider } from "@/app/context/kanban-context/index";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Kanban App",
};

const BCrumb = [
  {
    to: "/",
    title: "Home",
  },
  {
    title: "Kanban",
  },
];

function kanban() {
  return (
    <>
      <KanbanDataContextProvider>
        <BreadcrumbComp title="Kanban app" items={BCrumb} />
        <Card>
          <TaskManager />
        </Card>
      </KanbanDataContextProvider>
    </>
  );
}
export default kanban;
