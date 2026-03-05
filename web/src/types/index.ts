export interface Course {
    id: string;
    code: string;
    name: string;
    description: string;
    creditUnits: number;
    lecturerId: string;
    requiresLab: boolean;
    color?: string; // For UI visualization
}

export interface Lecturer {
    id: string;
    name: string;
    email: string;
    department: string;
    preferredTimeslots: number[]; // IDs of preferred slots
    unavailableTimeslots: number[];
}

export interface Room {
    id: string;
    name: string;
    capacity: number;
    isLab: boolean;
    building?: string;
}

export interface StudentGroup {
    id: string;
    name: string;
    size: number;
    courseIds: string[];
}

export interface Timeslot {
    id: number;
    day: number; // 0=Mon, 4=Fri
    period: number; // 1 to 9
    label: string; // "Mon 9:00"
}

export interface ScheduleEntry {
    id: string;
    courseId: string;
    lecturerId: string;
    studentGroupId: string;
    roomId: string;
    timeslotId: number;
}

export interface Timetable {
    id: string;
    projectId: string;
    fitness: number;
    hardConflicts: string[];
    softConflicts: string[];
    entries: ScheduleEntry[];
    createdAt: number;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
}
