"""
Genetics Cloud — Genetic Algorithm Engine
==========================================
Pure Python GA core for university timetable scheduling.

Completely decoupled from Django ORM — operates on lightweight
dataclasses passed in from the API layer. This keeps the engine
fast, testable, and portable.

Architecture
------------
1. **Data Structures**: Frozen dataclasses for immutable gene data;
   mutable ``ScheduleEntry`` for timetable slots.
2. **Evaluator**: Fitness function scoring 0.0–1.0 based on
   weighted hard/soft constraint violations.
3. **Mutator**: Adaptive mutation (15–30%) that swaps room or
   timeslot assignments.
4. **Crossover**: Single-point split producing one child from
   two parents.
5. **Evolution**: Generational loop with elitism, tournament
   selection, and adaptive mutation rate.

Usage
-----
::

    from scheduling.services.ga_engine import (
        LecturerData, StudentGroupData, RoomData, CourseData,
        TimeslotData, ConstraintData, GAConfig, run_evolution,
    )

    result = run_evolution(
        courses=[...], rooms=[...], timeslots=[...],
        lecturers=[...], groups=[...], constraints=[...],
        config=GAConfig(population_size=60, generations=200),
        on_progress=lambda gen, fitness: print(f"Gen {gen}: {fitness:.3f}"),
    )
"""

from __future__ import annotations

import copy
import random
import time
from dataclasses import dataclass, field
from typing import Callable, Optional


# ═════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class LecturerData:
    """Immutable lecturer snapshot passed into the engine."""
    id: int
    name: str
    department: str = ""
    preferences: dict = field(default_factory=dict)
    # preferences keys: morning_only, max_daily_hours, avoid_days, preferred_timeslots


@dataclass(frozen=True)
class StudentGroupData:
    """Immutable student group snapshot."""
    id: int
    name: str
    size: int = 0


@dataclass(frozen=True)
class RoomData:
    """Immutable room snapshot."""
    id: int
    name: str
    capacity: int = 0
    building: str = ""


@dataclass(frozen=True)
class CourseData:
    """Immutable course snapshot. duration_hours -> number of sessions."""
    id: int
    name: str
    code: str = ""
    duration_hours: int = 1
    lecturer_id: Optional[int] = None
    student_group_id: Optional[int] = None


@dataclass(frozen=True)
class TimeslotData:
    """One teaching period in the weekly grid."""
    id: int
    day: int          # 0=Mon, 1=Tue, ..., 4=Fri
    period: int       # 1-based period within the day
    start_time: str = ""   # "08:00"
    end_time: str = ""     # "09:00"


@dataclass
class ConstraintData:
    """A scheduling rule with type and weight."""
    name: str
    type: str          # "hard" or "soft"
    logic_type: str    # "room_conflict", "lecturer_conflict", etc.
    weight: int = 100
    enabled: bool = True


@dataclass
class GAConfig:
    """Configuration for the evolution run."""
    population_size: int = 50
    generations: int = 200
    elitism_count: int = 3
    tournament_size: int = 5
    mutation_rate_min: float = 0.15
    mutation_rate_max: float = 0.30
    crossover_rate: float = 0.85
    timeout_seconds: int = 3600  # ── FIX: Max 1 hour per GA run ──


# ═════════════════════════════════════════════════════════════
# SCHEDULE ENTRY (a single gene)
# ═════════════════════════════════════════════════════════════

@dataclass
class ScheduleEntry:
    """
    One scheduled class session (one 'gene').
    A timetable (chromosome) is a list of ScheduleEntry objects.
    """
    course_id: int
    lecturer_id: Optional[int]
    student_group_id: Optional[int]
    room_id: int
    timeslot_id: int

    def clone(self) -> ScheduleEntry:
        return ScheduleEntry(
            course_id=self.course_id,
            lecturer_id=self.lecturer_id,
            student_group_id=self.student_group_id,
            room_id=self.room_id,
            timeslot_id=self.timeslot_id,
        )


# Type alias: a timetable chromosome
Timetable = list[ScheduleEntry]


# ═════════════════════════════════════════════════════════════
# EVOLUTION RESULT
# ═════════════════════════════════════════════════════════════

@dataclass
class EvolutionResult:
    """Return value from run_evolution."""
    best_timetable: Timetable
    fitness: float
    hard_violations: int
    soft_violations: int
    execution_time_ms: int
    generations_run: int
    fitness_trend: list[float] = field(default_factory=list)


# ═════════════════════════════════════════════════════════════
# RANDOM TIMETABLE GENERATOR
# ═════════════════════════════════════════════════════════════

def generate_random_timetable(
    courses: list[CourseData],
    rooms: list[RoomData],
    timeslots: list[TimeslotData],
) -> Timetable:
    """
    Create a random timetable by assigning each course session
    a random room and timeslot.
    """
    room_ids = [r.id for r in rooms]
    timeslot_ids = [t.id for t in timeslots]
    entries: Timetable = []

    for course in courses:
        # Create one entry per duration hour (each is a weekly session)
        for _ in range(course.duration_hours):
            entries.append(ScheduleEntry(
                course_id=course.id,
                lecturer_id=course.lecturer_id,
                student_group_id=course.student_group_id,
                room_id=random.choice(room_ids),
                timeslot_id=random.choice(timeslot_ids),
            ))

    return entries


# ═════════════════════════════════════════════════════════════
# EVALUATOR (FITNESS FUNCTION)
# ═════════════════════════════════════════════════════════════

def evaluate_fitness(
    timetable: Timetable,
    rooms: list[RoomData],
    timeslots: list[TimeslotData],
    lecturers: list[LecturerData],
    groups: list[StudentGroupData],
    constraints: list[ConstraintData],
) -> tuple[float, int, int]:
    """
    Evaluate a timetable's fitness score.

    Returns:
        (fitness, hard_violation_count, soft_violation_count)

    Fitness is calculated as:
        fitness = max(0.0, 1.0 - total_penalty / max_penalty)

    Hard constraints (room/lecturer/group conflicts) are detected via
    NumPy vectorisation for a 5-15× speedup over Python dict loops.
    Soft constraints (capacity, preferences) use Python loops because they
    access JSON fields that cannot easily be vectorised.
    """
    import numpy as np

    if not timetable:
        return 1.0, 0, 0

    # ── Lookup tables ────────────────────────────────────────
    room_map     = {r.id: r for r in rooms}
    lecturer_map = {l.id: l for l in lecturers}
    group_map    = {g.id: g for g in groups}
    timeslot_map = {t.id: t for t in timeslots}

    active_constraints = {c.logic_type: c for c in constraints if c.enabled}

    hard_weight = 1000
    soft_weight = 50

    total_penalty  = 0.0
    hard_violations = 0
    soft_violations = 0

    n = len(timetable)

    # ── Build NumPy arrays once (reused for all hard checks) ─
    # Use -1 for None values so they never accidentally match each other
    room_arr     = np.array([e.room_id                          for e in timetable], dtype=np.int64)
    timeslot_arr = np.array([e.timeslot_id                      for e in timetable], dtype=np.int64)
    lecturer_arr = np.array([e.lecturer_id  if e.lecturer_id  is not None else -1 for e in timetable], dtype=np.int64)
    group_arr    = np.array([e.student_group_id if e.student_group_id is not None else -1 for e in timetable], dtype=np.int64)

    # ── FIX: Use structured array instead of PRIME encoding ──
    # Avoids collision risk when IDs exceed 10M
    # Each row is a (resource_id, timeslot_id) pair treated as unique tuple
    
    # ── Hard: Room double-booking ─────────────────────────────
    rc = active_constraints.get("room_conflict")
    if rc is None or rc.enabled:
        w = rc.weight if rc else hard_weight
        # Stack (room, timeslot) pairs and count duplicates
        room_slots = np.column_stack([room_arr, timeslot_arr])
        # Convert each row to a tuple for np.unique to treat them as unique combinations
        room_slots_view = np.ascontiguousarray(room_slots).view(
            np.dtype((np.void, room_slots.dtype.itemsize * room_slots.shape[1]))
        )
        _, counts = np.unique(room_slots_view, return_counts=True)
        conflicts = int(np.sum(counts[counts > 1] - 1))
        total_penalty  += conflicts * w
        hard_violations += conflicts

    # ── Hard: Lecturer double-booking ─────────────────────────
    lc = active_constraints.get("lecturer_conflict")
    if lc is None or lc.enabled:
        w = lc.weight if lc else hard_weight
        # Mask out the sentinel -1 (no lecturer assigned)
        mask      = lecturer_arr >= 0
        lec_slots = np.column_stack([lecturer_arr[mask], timeslot_arr[mask]])
        lec_slots_view = np.ascontiguousarray(lec_slots).view(
            np.dtype((np.void, lec_slots.dtype.itemsize * lec_slots.shape[1]))
        )
        _, counts = np.unique(lec_slots_view, return_counts=True)
        conflicts = int(np.sum(counts[counts > 1] - 1))
        total_penalty  += conflicts * w
        hard_violations += conflicts

    # ── Hard: Student group double-booking ───────────────────
    sc = active_constraints.get("group_conflict")
    if sc is None or sc.enabled:
        w    = hard_weight
        mask = group_arr >= 0
        grp_slots = np.column_stack([group_arr[mask], timeslot_arr[mask]])
        grp_slots_view = np.ascontiguousarray(grp_slots).view(
            np.dtype((np.void, grp_slots.dtype.itemsize * grp_slots.shape[1]))
        )
        _, counts = np.unique(grp_slots_view, return_counts=True)
        conflicts = int(np.sum(counts[counts > 1] - 1))
        total_penalty  += conflicts * w
        hard_violations += conflicts

    # ── Soft: Room capacity vs group size (Python loop — touches JSON) ─
    cap = active_constraints.get("capacity_overflow")
    if cap is None or cap.enabled:
        w = cap.weight if cap else soft_weight
        for e in timetable:
            room  = room_map.get(e.room_id)
            group = group_map.get(e.student_group_id)
            if room and group and group.size > room.capacity:
                overflow = group.size - room.capacity
                total_penalty  += w * (1 + overflow / 100)
                soft_violations += 1

    # ── Soft: Lecturer time preferences (Python loop — touches JSON) ──
    tp = active_constraints.get("lecturer_preference")
    if tp is None or tp.enabled:
        w = tp.weight if tp else soft_weight
        for e in timetable:
            if e.lecturer_id is None:
                continue
            lec = lecturer_map.get(e.lecturer_id)
            ts  = timeslot_map.get(e.timeslot_id)
            if not lec or not ts:
                continue
            prefs      = lec.preferences
            avoid_days = prefs.get("avoid_days", [])
            if ts.day in avoid_days:
                total_penalty  += w
                soft_violations += 1
            if prefs.get("morning_only") and ts.period > 4:
                total_penalty  += w * 0.5
                soft_violations += 1

    # ── Normalise 0.0–1.0 ─────────────────────────────────────
    max_penalty = n * (hard_weight * 3 + soft_weight * 2)
    fitness     = max(0.0, 1.0 - total_penalty / max_penalty)

    return fitness, hard_violations, soft_violations


# ═════════════════════════════════════════════════════════════
# MUTATOR (Adaptive 15-30%)
# ═════════════════════════════════════════════════════════════

def mutate(
    timetable: Timetable,
    rooms: list[RoomData],
    timeslots: list[TimeslotData],
    mutation_rate: float,
) -> Timetable:
    """
    Adaptive mutation: for each gene, with probability `mutation_rate`,
    randomly swap its room_id, timeslot_id, or both.
    """
    room_ids = [r.id for r in rooms]
    timeslot_ids = [t.id for t in timeslots]
    mutated = [e.clone() for e in timetable]

    for entry in mutated:
        if random.random() < mutation_rate:
            # Decide what to mutate: 40% room, 40% timeslot, 20% both
            roll = random.random()
            if roll < 0.4:
                entry.room_id = random.choice(room_ids)
            elif roll < 0.8:
                entry.timeslot_id = random.choice(timeslot_ids)
            else:
                entry.room_id = random.choice(room_ids)
                entry.timeslot_id = random.choice(timeslot_ids)

    return mutated


# ═════════════════════════════════════════════════════════════
# CROSSOVER (Single-Point)
# ═════════════════════════════════════════════════════════════

def crossover(parent_a: Timetable, parent_b: Timetable) -> Timetable:
    """
    Single-point crossover: pick a random split point and combine
    the first portion of parent_a with the second portion of parent_b.

    Both parents must have the same number of entries.
    """
    n = len(parent_a)
    if n <= 1:
        return [e.clone() for e in parent_a]

    split = random.randint(1, n - 1)
    child = [e.clone() for e in parent_a[:split]]
    child.extend(e.clone() for e in parent_b[split:])
    return child


# ═════════════════════════════════════════════════════════════
# SELECTION (Tournament)
# ═════════════════════════════════════════════════════════════

def tournament_select(
    population: list[Timetable],
    fitness_scores: list[float],
    tournament_size: int,
) -> Timetable:
    """
    Select a parent via tournament selection: pick `tournament_size`
    random individuals and return the fittest.
    """
    indices = random.sample(range(len(population)), min(tournament_size, len(population)))
    best_idx = max(indices, key=lambda i: fitness_scores[i])
    return population[best_idx]


# ═════════════════════════════════════════════════════════════
# EVOLUTION LOOP
# ═════════════════════════════════════════════════════════════

def run_evolution(
    courses: list[CourseData],
    rooms: list[RoomData],
    timeslots: list[TimeslotData],
    lecturers: list[LecturerData],
    groups: list[StudentGroupData],
    constraints: list[ConstraintData],
    config: GAConfig | None = None,
    on_progress: Callable[[int, float], None] | None = None,
    seed: int | None = None,
) -> EvolutionResult:
    """
    Run the full genetic algorithm evolution.

    Parameters
    ----------
    courses : list[CourseData]
        All courses to schedule.
    rooms : list[RoomData]
        Available rooms.
    timeslots : list[TimeslotData]
        Available time periods in the weekly grid.
    lecturers : list[LecturerData]
        Teaching staff with preferences.
    groups : list[StudentGroupData]
        Student cohorts with sizes.
    constraints : list[ConstraintData]
        Active hard/soft constraint rules.
    config : GAConfig, optional
        Evolution hyperparameters (defaults to GAConfig()).
    on_progress : callable, optional
        Callback ``(generation, best_fitness) -> None`` for progress updates.
    seed : int, optional
        Random seed for reproducibility. If None, uses random state.

    Returns
    -------
    EvolutionResult
        Best timetable, fitness, violations, timing, and fitness trend.
    """
    if config is None:
        config = GAConfig()

    # Validate inputs
    if not courses:
        raise ValueError("No courses provided — nothing to schedule.")
    if not rooms:
        raise ValueError("No rooms provided — cannot assign venues.")
    if not timeslots:
        raise ValueError("No timeslots provided — cannot assign time periods.")

    # ── FIX: Set random seed for reproducibility ──────────────
    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)

    start_time = time.time()

    # ── 1. Initialise population ────────────────────────────
    population: list[Timetable] = [
        generate_random_timetable(courses, rooms, timeslots)
        for _ in range(config.population_size)
    ]

    fitness_trend: list[float] = []
    best_ever_fitness = 0.0
    best_ever_timetable: Timetable = population[0]
    best_ever_hard = 0
    best_ever_soft = 0

    # ── 2. Generational loop with timeout protection ────────
    for gen in range(config.generations):
        # ── FIX: Check for timeout every generation ──────────
        elapsed_sec = time.time() - start_time
        if elapsed_sec > config.timeout_seconds:
            logger_module = __import__('logging').getLogger(__name__)
            logger_module.warning(
                f"[GA] Timeout exceeded ({elapsed_sec:.1f}s > {config.timeout_seconds}s). "
                f"Terminating at generation {gen}/{config.generations}."
            )
            break

        # Evaluate entire population
        evaluations = [
            evaluate_fitness(tt, rooms, timeslots, lecturers, groups, constraints)
            for tt in population
        ]
        fitness_scores = [e[0] for e in evaluations]

        # Track best
        gen_best_idx = max(range(len(fitness_scores)), key=lambda i: fitness_scores[i])
        gen_best_fitness = fitness_scores[gen_best_idx]
        fitness_trend.append(round(gen_best_fitness, 4))

        if gen_best_fitness > best_ever_fitness:
            best_ever_fitness = gen_best_fitness
            best_ever_timetable = [e.clone() for e in population[gen_best_idx]]
            best_ever_hard = evaluations[gen_best_idx][1]
            best_ever_soft = evaluations[gen_best_idx][2]

        # Progress callback
        if on_progress:
            on_progress(gen, gen_best_fitness)

        # Early termination: perfect fitness
        if gen_best_fitness >= 1.0:
            break

        # ── Adaptive mutation rate ──────────────────────────
        # High fitness → lower mutation (fine-tune)
        # Low fitness → higher mutation (explore)
        progress = gen_best_fitness
        mutation_rate = config.mutation_rate_max - (
            (config.mutation_rate_max - config.mutation_rate_min) * progress
        )

        # ── Elitism: carry top performers unchanged ─────────
        ranked = sorted(
            range(len(population)),
            key=lambda i: fitness_scores[i],
            reverse=True,
        )
        elites = [
            [e.clone() for e in population[i]]
            for i in ranked[:config.elitism_count]
        ]

        # ── Build next generation ───────────────────────────
        next_gen: list[Timetable] = list(elites)

        while len(next_gen) < config.population_size:
            parent_a = tournament_select(
                population, fitness_scores, config.tournament_size,
            )
            parent_b = tournament_select(
                population, fitness_scores, config.tournament_size,
            )

            # Crossover
            if random.random() < config.crossover_rate:
                child = crossover(parent_a, parent_b)
            else:
                child = [e.clone() for e in parent_a]

            # Mutation
            child = mutate(child, rooms, timeslots, mutation_rate)
            next_gen.append(child)

        population = next_gen

    # ── 3. Final evaluation of best-ever ────────────────────
    elapsed_ms = int((time.time() - start_time) * 1000)

    return EvolutionResult(
        best_timetable=best_ever_timetable,
        fitness=round(best_ever_fitness, 4),
        hard_violations=best_ever_hard,
        soft_violations=best_ever_soft,
        execution_time_ms=elapsed_ms,
        generations_run=len(fitness_trend),
        fitness_trend=fitness_trend,
    )
