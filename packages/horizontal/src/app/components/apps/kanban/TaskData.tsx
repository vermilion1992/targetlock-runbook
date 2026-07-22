"use client";
import { useContext, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import EditTaskModal from "./task-modal/EditTaskModal";
import { KanbanDataContext } from "@/app/context/kanban-context/index";
import { Draggable } from "@hello-pangea/dnd";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { patchFetcher } from "@/app/api/global-fetcher";
import { mutate } from "swr";
import Image from "next/image";
import { StaticImport } from "next/dist/shared/lib/get-img-props";

interface TaskDataProps {
  task: { id: string };
  onDeleteTask: () => void;
  index: number;
  category: { name: string };
}
const TaskData: React.FC<TaskDataProps> = ({
  task,
  onDeleteTask,
  index,
  category,
}: any) => {
  const { setError, todoCategories, setTodoCategories } =
    useContext(KanbanDataContext);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [anchorEl, setAnchorEl] = useState(false);

  const handleShowEditModal = () => setShowEditModal(true);
  const handleCloseEditModal = () => setShowEditModal(false);

  const handleDeleteClick = () => onDeleteTask(task.id);

  const handleSaveEditedTask = async (editedTaskData: { id: string }) => {
    try {
      const response = await mutate(
        "/api/kanban",
        patchFetcher("/api/kanban/edit-task", {
          taskId: editedTaskData.id,
          newData: editedTaskData,
        }),
        false
      );
      if (response.status === 200) {
        setEditedTask(editedTaskData);
        let remainingTodos = todoCategories.map((item) => {
          if (item.name === category.name) {
            let updatedChild = item.child.map((task) => {
              if (task.id === editedTaskData.id) {
                return { ...task, editedTaskData };
              }
              return task;
            });
            return {
              ...item,
              child: updatedChild,
            };
          } else {
            return item;
          }
        });
        setTodoCategories(remainingTodos);
      } else {
        throw new Error("Failed to edit task");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setError(errorMessage);
    }
  };

  useEffect(() => {}, [editedTask]);

  const formatDate = (selectedDate: string | number | Date) => {
    const dateObj = new Date(selectedDate);
    const day = dateObj.getDate();
    const month = dateObj.toLocaleString("default", { month: "long" });
    return `${day} ${month}`;
  };

  const backgroundColor =
    editedTask.priority === "Normal Priority"
      ? "lightgray"
      : editedTask.priority === "Medium Priority"
      ? "lightInfo"
      : editedTask.priority === "High Priority"
      ? "lightError"
      : "white";

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="flex flex-col gap-3 bg-card rounded-md dark:shadow-dark-md shadow-md p-3"
        >
          {/* image */}
          <div>
            {editedTask.taskImage && (
              <Image
                src={editedTask.taskImage}
                alt="Task Image"
                className="w-full h-full rounded-md"
                width={243}
                height={172}
              />
            )}
          </div>
          {/* title */}
          <div>
            <h5 className="text-base font-semibold line-clamp-2">
              {editedTask.taskTitle}
            </h5>
          </div>
          {/* user and badge */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex flex-1 flex-wrap -space-x-1.5">
              {editedTask.assignedTo.map(
                (user: { avatar: string | StaticImport }, index: number) => (
                  <Image
                    key={index}
                    src={user.avatar}
                    alt="user"
                    width={26}
                    height={26}
                    className="rounded-full bg-gray-300 dark:bg-neutral-500 border border-white dark:border-white/40"
                  />
                )
              )}
            </div>
            <div>
              <Badge variant={`${backgroundColor}`}>
                {editedTask.priority}
              </Badge>
            </div>
          </div>
          <hr className="border-border" />
          {/* footer links */}
          <div className="flex items-center justify-between">
            {/* link and comment */}
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <Icon
                  icon={"solar:link-minimalistic-2-line-duotone"}
                  width={20}
                  height={20}
                />
                <p>{editedTask.attachments.length}</p>
              </div>
              <div className="flex items-center gap-2">
                <Icon
                  icon={"solar:chat-dots-line-duotone"}
                  width={20}
                  height={20}
                />
                <p>{editedTask.comments.length}</p>
              </div>
            </div>
            {/* edit options */}
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span className="btn-circle-hover cursor-pointer p-0 h-6 w-6">
                    <Icon
                      icon="solar:menu-dots-bold-duotone"
                      width={20}
                      height={20}
                    />
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-32">
                  <DropdownMenuItem
                    onClick={handleShowEditModal}
                    className="flex gap-2 items-center"
                  >
                    <Icon icon="solar:pen-new-square-broken" height={15} />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="flex gap-2 items-center"
                  >
                    <Icon
                      icon="solar:trash-bin-minimalistic-outline"
                      height={15}
                    />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <EditTaskModal
                show={showEditModal}
                onHide={handleCloseEditModal}
                task={task}
                editedTask={editedTask}
                onSave={handleSaveEditedTask}
              />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
export default TaskData;
