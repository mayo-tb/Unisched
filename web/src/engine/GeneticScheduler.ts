import type { Course, Lecturer, Room, ScheduleEntry, StudentGroup, Timeslot, Timetable } from '../types';

export interface GAConfig {
    populationSize: number;
    mutationRate: number;
    crossoverRate: number;
    elitismCount: number;
    hardPenalty: number;
    softPenalty: number;
    softBonus: number;
}

export class GeneticScheduler {
    private population: Timetable[] = [];
    private generation: number = 0;
    private config: GAConfig;
    private geneBlueprint: Array<{ courseId: string; lecturerId: string; groupId: string }> = [];

    // Lookups
    private roomIds: string[];
    private timeslotIds: number[];
    private roomsMap: Map<string, Room>;
    private groupsMap: Map<string, StudentGroup>;
    private coursesMap: Map<string, Course>;

    constructor(
        courses: Course[],
        rooms: Room[],
        _lecturers: Lecturer[], // Prefixed with _ to ignore unused warning
        groups: StudentGroup[],
        timeslots: Timeslot[],
        config?: Partial<GAConfig>
    ) {
        this.config = {
            populationSize: 50,
            mutationRate: 0.05,
            crossoverRate: 0.8,
            elitismCount: 2,
            hardPenalty: -1000,
            softPenalty: -10,
            softBonus: 10,
            ...config
        };

        this.roomIds = rooms.map(r => r.id);
        this.timeslotIds = timeslots.map(t => t.id);
        this.roomsMap = new Map(rooms.map(r => [r.id, r]));
        this.groupsMap = new Map(groups.map(g => [g.id, g]));
        this.coursesMap = new Map(courses.map(c => [c.id, c]));

        // Build Blueprint
        groups.forEach(group => {
            group.courseIds.forEach(cId => {
                const course = this.coursesMap.get(cId);
                if (course) {
                    for (let i = 0; i < course.creditUnits; i++) {
                        this.geneBlueprint.push({
                            courseId: course.id,
                            lecturerId: course.lecturerId,
                            groupId: group.id
                        });
                    }
                }
            });
        });
    }

    private randomChoice<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    private generateIndividual(): Timetable {
        const entries: ScheduleEntry[] = this.geneBlueprint.map((gene, idx) => ({
            id: `g-${idx}`,
            courseId: gene.courseId,
            lecturerId: gene.lecturerId,
            studentGroupId: gene.groupId,
            roomId: this.randomChoice(this.roomIds),
            timeslotId: this.randomChoice(this.timeslotIds),
        }));

        return {
            id: crypto.randomUUID(),
            projectId: 'temp',
            entries,
            fitness: 0,
            hardConflicts: [],
            softConflicts: [],
            createdAt: Date.now()
        };
    }

    public evaluate(timetable: Timetable): number {
        let score = 0;
        const hard: string[] = [];
        const soft: string[] = [];

        const roomBookings = new Map<string, number>();
        const lecturerBookings = new Map<string, number>();
        const groupBookings = new Map<string, number>();

        timetable.entries.forEach(entry => {
            const ts = entry.timeslotId;

            // 1. Double Bookings
            const rKey = `${ts}-${entry.roomId}`;
            if (roomBookings.has(rKey)) { score += this.config.hardPenalty; hard.push(`Room double booked @ ${ts}`); }
            roomBookings.set(rKey, (roomBookings.get(rKey) || 0) + 1);

            const lKey = `${ts}-${entry.lecturerId}`;
            if (lecturerBookings.has(lKey)) { score += this.config.hardPenalty; hard.push(`Lecturer double booked @ ${ts}`); }
            lecturerBookings.set(lKey, (lecturerBookings.get(lKey) || 0) + 1);

            const gKey = `${ts}-${entry.studentGroupId}`;
            if (groupBookings.has(gKey)) { score += this.config.hardPenalty; hard.push(`Group double booked @ ${ts}`); }
            groupBookings.set(gKey, (groupBookings.get(gKey) || 0) + 1);

            // 2. Capacity
            const room = this.roomsMap.get(entry.roomId);
            const group = this.groupsMap.get(entry.studentGroupId);
            if (room && group && room.capacity < group.size) {
                score += this.config.softPenalty;
                soft.push(`Room too small for group ${group.name}`);
            }
        });

        timetable.fitness = score;
        timetable.hardConflicts = hard;
        timetable.softConflicts = soft;
        return score;
    }

    public async initialize() {
        this.population = Array.from({ length: this.config.populationSize }, () => this.generateIndividual());
        this.population.forEach(ind => this.evaluate(ind));
        this.generation = 0;
    }

    public async runStep(): Promise<{ best: Timetable, generation: number }> {
        // Sort
        this.population.sort((a, b) => b.fitness - a.fitness);
        const currentBest = this.population[0];

        // Elitism
        const newPop = this.population.slice(0, this.config.elitismCount);

        // Breed
        while (newPop.length < this.config.populationSize) {
            // Simple Tournament
            const p1 = this.randomChoice(this.population.slice(0, 10)); // Bias towards top 10
            const p2 = this.randomChoice(this.population.slice(0, 10));

            // Crossover
            const cut = Math.floor(Math.random() * p1.entries.length);
            const childEntries = [
                ...p1.entries.slice(0, cut),
                ...p2.entries.slice(cut)
            ];

            // Mutate
            childEntries.forEach(entry => {
                if (Math.random() < this.config.mutationRate) {
                    if (Math.random() > 0.5) entry.roomId = this.randomChoice(this.roomIds);
                    else entry.timeslotId = this.randomChoice(this.timeslotIds);
                }
            });

            const child: Timetable = {
                ...p1, // Copy metadata
                id: crypto.randomUUID(),
                entries: childEntries,
                fitness: 0
            };

            this.evaluate(child);
            newPop.push(child);
        }

        this.population = newPop;
        this.generation++;

        return { best: currentBest, generation: this.generation };
    }
}
