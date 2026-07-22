import { Chance } from "chance";
import { TodoCategory } from "@/app/(DashboardLayout)/types/apps/kanban";
const chance = new Chance();

export const KanbanData: TodoCategory[] = [
  {
    id: "1",
    name: "New Request",
    child: [
      {
        id: "101",
        taskTitle: "Prepare project scope",
        taskImage: "/images/blog/blog-image10.jpg",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: " 10 May 2025",
        labels: ["Design", "Sales"],
        priority: "Normal Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/olivia.png",
          },
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/jason.png",
          },
        ],
        attachments: [{ url: "/images/kanban/img1.png" }],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/jason.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
          {
            author: chance.name(),
            avatar: "/images/profile/olivia.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
      {
        id: "102",
        taskTitle: "Initial client meeting",
        taskImage: "",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "06 May 2025",
        labels: ["Development"],
        priority: "Medium Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/emily.png",
          },
          {
            name: chance.first(),
            avatar: "/images/profile/ryan.png",
            id: chance.android_id(),
          },
          {
            name: chance.first(),
            avatar: "/images/profile/olivia.png",
            id: chance.android_id(),
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/ryan.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
      {
        id: "103",
        taskTitle: "Collect project requirements",
        taskImage: "",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "8 july 2021",
        labels: ["Marketing"],
        priority: "Normal Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/ryan.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/olivia.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "In Progress",

    child: [
      {
        id: "201",
        taskTitle: "Design homepage layout",
        taskImage: "",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "16 May 2025",
        labels: ["Research"],
        priority: "High Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/olivia.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/emily.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
      {
        id: "202",
        taskTitle: "Set up development environment",
        taskImage: "",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "12 May 2025",
        labels: ["QA"],
        priority: "Normal Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/jason.png",
          },
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/emily.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/Kiley.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
    ],
  },
  {
    id: "3",
    name: "Complete",

    child: [
      {
        id: "301",
        taskTitle: "Create wireframes",
        taskImage: "",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "03 May 2025",
        labels: ["Technology", "Product"],
        priority: "Normal Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/Kiley.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/Dalton.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
      {
        id: "302",
        taskTitle: "Approve branding guidelines",
        taskImage: "/images/blog/blog-image9.jpg",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "10 May 2025",
        labels: ["Sales", "Design"],
        priority: "Normal Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/olivia.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/Juan.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
      {
        id: "303",
        taskTitle: "Finalize user personas",
        taskImage: "",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "06 May 2025",
        labels: ["Technology", "Support"],
        priority: "High Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/Dalton.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/Kiley.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
      {
        id: "304",
        taskTitle: "Research competitor websites",
        taskImage: "",
        taskText: chance.paragraph({ sentences: 1 }),
        dueDate: "06 May 2025",
        labels: ["Marketing", "Research"],
        priority: "Medium Priority",

        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/emily.png",
          },
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/ryan.png",
          },
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/jason.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/jason.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
    ],
  },
  {
    id: "4",
    name: "BackLog",

    child: [
      {
        id: "401",
        taskTitle: "Plan marketing launch",
        dueDate: "06 May 2025",
        labels: ["Design", "Development"],
        priority: "Normal Priority",
        assignedTo: [
          {
            id: chance.android_id(),
            name: chance.first(),
            avatar: "/images/profile/olivia.png",
          },
        ],
        attachments: [],
        comments: [
          {
            author: chance.name(),
            avatar: "/images/profile/Reva.png",
            text: chance.paragraph({ sentences: 2 }),
            date: "09 April 2025",
          },
        ],
        subtasks: [
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: true },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
          { title: chance.sentence({ words: 4 }), isCompleted: false },
        ],
      },
    ],
  },
];
// Extracting unique task properties from TodoData
const taskPropertiesSet = new Set<string>();

// Using forEach loops instead of flatMap
KanbanData.forEach((category) => {
  category.child.forEach((task: { priority: string }) => {
    taskPropertiesSet.add(task.priority);
  });
});

// Convert Set to array
export const TaskProperties = Array.from(taskPropertiesSet);

const labelSet = new Set<string>();

KanbanData.forEach((category) => {
  category.child.forEach((task) => {
    (task.labels || []).forEach((label: string) => {
      labelSet.add(label);
    });
  });
});

export const AllLabels = Array.from(labelSet);

const assignedToSet = new Set<string>(); // Use Set to ensure unique entries

// We will store unique objects with 'name' and 'avatar' properties
const assignedToData: { name: string; avatar: string }[] = [];

KanbanData.forEach((categorys) => {
  categorys.child.forEach((task) => {
    (task.assignedTo || []).forEach(
      (assignedTo: { name: string; avatar: string }) => {
        // Create a unique key for the name and avatar combination
        const user = { name: assignedTo.name, avatar: assignedTo.avatar };
        if (
          !assignedToData.some(
            (u) => u.name === user.name && u.avatar === user.avatar
          )
        ) {
          assignedToData.push(user);
        }
      }
    );
  });
});

// Now, `assignedToData` will contain unique objects with name and avatar
export const AllassignedTo = assignedToData;
