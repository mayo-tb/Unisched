"""
Genetics Cloud — GA Engine Unit Tests
=======================================
Run with:
    cd backend
    python -m pytest scheduling/services/test_ga_engine.py -v

Tests cover:
    - Data structure creation
    - Fitness evaluator with explicit hard/soft conflict verification
    - Adaptive mutation behaviour
    - Single-point crossover correctness
    - Full evolution convergence
"""

import random
import pytest

from scheduling.services.ga_engine import (
    LecturerData, StudentGroupData, RoomData, CourseData,
    TimeslotData, ConstraintData, ScheduleEntry, GAConfig,
    generate_random_timetable, evaluate_fitness,
    mutate, crossover, run_evolution,
)


# ─────────────────────────────────────────────────────────────
# Fixtures — shared mock data
# ─────────────────────────────────────────────────────────────

@pytest.fixture
def lecturers():
    return [
        LecturerData(id=1, name="Dr. Smith", department="CS",
                     preferences={"morning_only": True, "avoid_days": [4]}),
        LecturerData(id=2, name="Dr. Jones", department="Math",
                     preferences={}),
    ]


@pytest.fixture
def groups():
    return [
        StudentGroupData(id=1, name="CSC 300", size=60),
        StudentGroupData(id=2, name="MAT 200", size=40),
    ]


@pytest.fixture
def rooms():
    return [
        RoomData(id=1, name="LT-A", capacity=100, building="Main"),
        RoomData(id=2, name="Lab-1", capacity=30, building="Science"),
        RoomData(id=3, name="LT-B", capacity=80, building="Main"),
    ]


@pytest.fixture
def timeslots():
    slots = []
    slot_id = 1
    for day in range(5):        # Mon-Fri
        for period in range(1, 9):  # 8 periods per day
            slots.append(TimeslotData(
                id=slot_id, day=day, period=period,
                start_time=f"{7+period}:00", end_time=f"{8+period}:00",
            ))
            slot_id += 1
    return slots


@pytest.fixture
def courses():
    return [
        CourseData(id=1, name="Data Structures", code="CSC201",
                   duration_hours=2, lecturer_id=1, student_group_id=1),
        CourseData(id=2, name="Calculus", code="MAT101",
                   duration_hours=1, lecturer_id=2, student_group_id=2),
        CourseData(id=3, name="Algorithms", code="CSC301",
                   duration_hours=1, lecturer_id=1, student_group_id=1),
    ]


@pytest.fixture
def constraints():
    return [
        ConstraintData(name="No Room Conflicts", type="hard",
                       logic_type="room_conflict", weight=1000),
        ConstraintData(name="No Lecturer Overlap", type="hard",
                       logic_type="lecturer_conflict", weight=1000),
        ConstraintData(name="Room Capacity", type="soft",
                       logic_type="capacity_check", weight=50),
        ConstraintData(name="Time Preferences", type="soft",
                       logic_type="time_preference", weight=30),
    ]


# ─────────────────────────────────────────────────────────────
# Test: Data Structures
# ─────────────────────────────────────────────────────────────

class TestDataStructures:

    def test_lecturer_data_frozen(self):
        lec = LecturerData(id=1, name="Dr. X", department="CS")
        with pytest.raises(AttributeError):
            lec.name = "Changed"

    def test_room_data_defaults(self):
        room = RoomData(id=1, name="Room A")
        assert room.capacity == 0
        assert room.building == ""

    def test_schedule_entry_clone(self):
        entry = ScheduleEntry(
            course_id=1, lecturer_id=2,
            student_group_id=3, room_id=4, timeslot_id=5
        )
        clone = entry.clone()
        assert clone.course_id == entry.course_id
        assert clone is not entry  # Different object

    def test_ga_config_defaults(self):
        cfg = GAConfig()
        assert cfg.population_size == 50
        assert cfg.generations == 200
        assert cfg.mutation_rate_min == 0.15
        assert cfg.mutation_rate_max == 0.30


# ─────────────────────────────────────────────────────────────
# Test: Random Timetable Generation
# ─────────────────────────────────────────────────────────────

class TestRandomGeneration:

    def test_correct_entry_count(self, courses, rooms, timeslots):
        tt = generate_random_timetable(courses, rooms, timeslots)
        # CSC201: 2h, MAT101: 1h, CSC301: 1h → 4 entries
        assert len(tt) == 4

    def test_entries_use_valid_ids(self, courses, rooms, timeslots):
        tt = generate_random_timetable(courses, rooms, timeslots)
        room_ids = {r.id for r in rooms}
        timeslot_ids = {t.id for t in timeslots}
        for entry in tt:
            assert entry.room_id in room_ids
            assert entry.timeslot_id in timeslot_ids


# ─────────────────────────────────────────────────────────────
# Test: Fitness Evaluator
# ─────────────────────────────────────────────────────────────

class TestFitnessEvaluator:

    def test_perfect_schedule_high_fitness(
        self, rooms, timeslots, lecturers, groups, constraints
    ):
        """A schedule with zero conflicts should have near-perfect fitness."""
        timetable = [
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=1),
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=2, timeslot_id=2),
            ScheduleEntry(course_id=2, lecturer_id=2, student_group_id=2,
                          room_id=3, timeslot_id=3),
            ScheduleEntry(course_id=3, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=4),
        ]
        fitness, hard, soft = evaluate_fitness(
            timetable, rooms, timeslots, lecturers, groups, constraints,
        )
        assert fitness > 0.9, f"Expected high fitness, got {fitness}"
        assert hard == 0, f"Expected 0 hard violations, got {hard}"

    def test_room_conflict_drops_fitness(
        self, rooms, timeslots, lecturers, groups, constraints
    ):
        """Two classes in the SAME room at the SAME time = hard violation."""
        timetable = [
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=1),
            ScheduleEntry(course_id=2, lecturer_id=2, student_group_id=2,
                          room_id=1, timeslot_id=1),  # SAME room+slot!
        ]
        fitness, hard, soft = evaluate_fitness(
            timetable, rooms, timeslots, lecturers, groups, constraints,
        )
        assert hard >= 1, "Room conflict should produce hard violation"
        assert fitness < 0.9, f"Fitness should drop significantly, got {fitness}"

    def test_lecturer_conflict_drops_fitness(
        self, rooms, timeslots, lecturers, groups, constraints
    ):
        """Same lecturer in two different rooms at the same time."""
        timetable = [
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=1),
            ScheduleEntry(course_id=3, lecturer_id=1, student_group_id=1,
                          room_id=2, timeslot_id=1),  # SAME lecturer+slot!
        ]
        fitness, hard, soft = evaluate_fitness(
            timetable, rooms, timeslots, lecturers, groups, constraints,
        )
        assert hard >= 1, "Lecturer conflict should produce hard violation"
        assert fitness < 0.9

    def test_student_group_conflict(
        self, rooms, timeslots, lecturers, groups, constraints
    ):
        """Same student group in two classes at the same time."""
        timetable = [
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=1),
            ScheduleEntry(course_id=3, lecturer_id=1, student_group_id=1,
                          room_id=2, timeslot_id=1),  # SAME group+slot!
        ]
        fitness, hard, soft = evaluate_fitness(
            timetable, rooms, timeslots, lecturers, groups, constraints,
        )
        assert hard >= 1, "Student group conflict should register"

    def test_capacity_soft_violation(
        self, timeslots, lecturers, groups, constraints
    ):
        """Group of 60 in a room with capacity 30 → soft violation."""
        small_rooms = [RoomData(id=2, name="Lab-1", capacity=30)]
        timetable = [
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=2, timeslot_id=1),
        ]
        fitness, hard, soft = evaluate_fitness(
            timetable, small_rooms, timeslots, lecturers, groups, constraints,
        )
        assert soft >= 1, "Capacity overflow should register soft violation"
        assert hard == 0, "Capacity is soft, not hard"

    def test_lecturer_preference_violation(
        self, rooms, lecturers, groups, constraints
    ):
        """Dr. Smith avoids day 4 (Friday). Scheduling on Friday → soft violation."""
        # Timeslot on Friday (day=4), period=1
        friday_slots = [TimeslotData(id=99, day=4, period=1)]
        timetable = [
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=99),
        ]
        fitness, hard, soft = evaluate_fitness(
            timetable, rooms, friday_slots, lecturers, groups, constraints,
        )
        assert soft >= 1, "Avoid-day preference should trigger soft violation"

    def test_empty_timetable_perfect(
        self, rooms, timeslots, lecturers, groups, constraints
    ):
        """Empty timetable has nothing to violate."""
        fitness, hard, soft = evaluate_fitness(
            [], rooms, timeslots, lecturers, groups, constraints,
        )
        assert fitness == 1.0

    def test_multiple_hard_conflicts_compound(
        self, rooms, timeslots, lecturers, groups, constraints
    ):
        """3 classes all in the same room+time = severe penalty."""
        timetable = [
            ScheduleEntry(course_id=1, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=1),
            ScheduleEntry(course_id=2, lecturer_id=2, student_group_id=2,
                          room_id=1, timeslot_id=1),
            ScheduleEntry(course_id=3, lecturer_id=1, student_group_id=1,
                          room_id=1, timeslot_id=1),
        ]
        fitness, hard, soft = evaluate_fitness(
            timetable, rooms, timeslots, lecturers, groups, constraints,
        )
        assert hard >= 2, f"Expected ≥2 hard violations, got {hard}"
        assert fitness < 0.7, "Triple conflict should severely drop fitness"


# ─────────────────────────────────────────────────────────────
# Test: Mutation
# ─────────────────────────────────────────────────────────────

class TestMutation:

    def test_mutation_produces_changes(self, rooms, timeslots):
        """With 100% mutation rate, at least some genes should change."""
        original = [
            ScheduleEntry(1, 1, 1, rooms[0].id, timeslots[0].id)
            for _ in range(20)
        ]
        mutated = mutate(original, rooms, timeslots, mutation_rate=1.0)
        assert len(mutated) == len(original)
        changes = sum(
            1 for o, m in zip(original, mutated)
            if o.room_id != m.room_id or o.timeslot_id != m.timeslot_id
        )
        assert changes > 0, "100% rate should produce at least one change"

    def test_zero_mutation_no_changes(self, rooms, timeslots):
        """With 0% mutation rate, nothing should change."""
        original = [
            ScheduleEntry(1, 1, 1, rooms[0].id, timeslots[0].id)
            for _ in range(20)
        ]
        mutated = mutate(original, rooms, timeslots, mutation_rate=0.0)
        for o, m in zip(original, mutated):
            assert o.room_id == m.room_id
            assert o.timeslot_id == m.timeslot_id

    def test_mutation_does_not_alter_original(self, rooms, timeslots):
        """Mutation should return a new list, not modify in place."""
        original = [ScheduleEntry(1, 1, 1, rooms[0].id, timeslots[0].id)]
        original_room = original[0].room_id
        original_ts = original[0].timeslot_id
        mutate(original, rooms, timeslots, mutation_rate=1.0)
        assert original[0].room_id == original_room
        assert original[0].timeslot_id == original_ts


# ─────────────────────────────────────────────────────────────
# Test: Crossover
# ─────────────────────────────────────────────────────────────

class TestCrossover:

    def test_crossover_length_preserved(self):
        """Child should have same length as parents."""
        parent_a = [ScheduleEntry(i, 1, 1, 1, 1) for i in range(10)]
        parent_b = [ScheduleEntry(i, 2, 2, 2, 2) for i in range(10)]
        child = crossover(parent_a, parent_b)
        assert len(child) == 10

    def test_crossover_mixes_parents(self):
        """Child should contain genes from both parents (over many runs)."""
        parent_a = [ScheduleEntry(i, 1, 1, room_id=100, timeslot_id=1) for i in range(10)]
        parent_b = [ScheduleEntry(i, 2, 2, room_id=200, timeslot_id=2) for i in range(10)]

        has_from_a = False
        has_from_b = False
        for _ in range(50):  # Run many times to account for random split
            child = crossover(parent_a, parent_b)
            for entry in child:
                if entry.room_id == 100:
                    has_from_a = True
                if entry.room_id == 200:
                    has_from_b = True
            if has_from_a and has_from_b:
                break

        assert has_from_a and has_from_b, "Child should contain genes from both parents"

    def test_crossover_creates_new_objects(self):
        """Child entries should be clones, not references."""
        parent_a = [ScheduleEntry(1, 1, 1, 1, 1)]
        parent_b = [ScheduleEntry(1, 2, 2, 2, 2)]
        child = crossover(parent_a, parent_b)
        assert child[0] is not parent_a[0]
        assert child[0] is not parent_b[0]


# ─────────────────────────────────────────────────────────────
# Test: Full Evolution
# ─────────────────────────────────────────────────────────────

class TestEvolution:

    def test_evolution_improves_fitness(
        self, courses, rooms, timeslots, lecturers, groups, constraints
    ):
        """Fitness should improve over generations."""
        random.seed(42)
        result = run_evolution(
            courses=courses, rooms=rooms, timeslots=timeslots,
            lecturers=lecturers, groups=groups, constraints=constraints,
            config=GAConfig(population_size=30, generations=50),
        )
        assert result.fitness > 0.0
        assert result.generations_run > 0
        assert result.execution_time_ms >= 0
        assert len(result.fitness_trend) > 0
        # Fitness should be better at the end than the start
        assert result.fitness_trend[-1] >= result.fitness_trend[0]

    def test_evolution_returns_valid_entries(
        self, courses, rooms, timeslots, lecturers, groups, constraints
    ):
        """Best timetable should have correct number of entries."""
        random.seed(42)
        result = run_evolution(
            courses=courses, rooms=rooms, timeslots=timeslots,
            lecturers=lecturers, groups=groups, constraints=constraints,
            config=GAConfig(population_size=20, generations=10),
        )
        expected_entries = sum(c.duration_hours for c in courses)
        assert len(result.best_timetable) == expected_entries

    def test_evolution_progress_callback(
        self, courses, rooms, timeslots, lecturers, groups, constraints
    ):
        """on_progress callback should be called each generation."""
        progress_log = []
        run_evolution(
            courses=courses, rooms=rooms, timeslots=timeslots,
            lecturers=lecturers, groups=groups, constraints=constraints,
            config=GAConfig(population_size=10, generations=5),
            on_progress=lambda gen, fit: progress_log.append((gen, fit)),
        )
        assert len(progress_log) >= 5

    def test_evolution_no_courses_raises(self, rooms, timeslots, lecturers, groups, constraints):
        with pytest.raises(ValueError, match="No courses"):
            run_evolution([], rooms, timeslots, lecturers, groups, constraints)

    def test_evolution_no_rooms_raises(self, courses, timeslots, lecturers, groups, constraints):
        with pytest.raises(ValueError, match="No rooms"):
            run_evolution(courses, [], timeslots, lecturers, groups, constraints)

    def test_hard_conflict_in_evolution_result(
        self, rooms, timeslots, lecturers, groups
    ):
        """
        With very few rooms and timeslots, hard conflicts are unavoidable.
        The result should report them.
        """
        # Only 1 room, 1 timeslot → guaranteed conflicts
        tiny_rooms = [RoomData(id=1, name="Only Room", capacity=200)]
        tiny_slots = [TimeslotData(id=1, day=0, period=1)]
        courses_conflict = [
            CourseData(id=1, name="A", code="A1", lecturer_id=1, student_group_id=1),
            CourseData(id=2, name="B", code="B1", lecturer_id=2, student_group_id=2),
        ]
        constraints_hard = [
            ConstraintData("Room", "hard", "room_conflict", 1000),
        ]
        result = run_evolution(
            courses=courses_conflict, rooms=tiny_rooms, timeslots=tiny_slots,
            lecturers=lecturers, groups=groups, constraints=constraints_hard,
            config=GAConfig(population_size=10, generations=10),
        )
        # With 1 room and 1 slot for 2 courses, conflict is unavoidable
        assert result.hard_violations >= 1 or result.fitness < 1.0
