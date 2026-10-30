import { compareCodepoints } from './eligibility.constants.js';

export interface CorequisiteComponent {
  id: string;
  courseIds: readonly string[];
  dependencyComponentIds: readonly string[];
}
export interface CorequisiteGraph {
  components: readonly CorequisiteComponent[];
  componentOfCourse: ReadonlyMap<string, string>;
  dependencyFirstOrder: readonly string[];
}
export function buildCorequisiteGraph(
  courseIds: readonly string[],
  requirements: ReadonlyMap<string, readonly string[]>,
): CorequisiteGraph {
  const ids = [...new Set(courseIds)].sort(compareCodepoints);
  const allowed = new Set(ids);
  const edges = new Map(
    ids.map((id) => [
      id,
      [...new Set(requirements.get(id) ?? [])]
        .filter((target) => allowed.has(target))
        .sort(compareCodepoints),
    ]),
  );
  const reverse = new Map(ids.map((id) => [id, [] as string[]]));
  edges.forEach((targets, id) =>
    targets.forEach((target) => reverse.get(target)!.push(id)),
  );
  const visited = new Set<string>();
  const finished: string[] = [];
  for (const root of ids) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack = [{ id: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const targets = edges.get(frame.id)!;
      if (frame.next === targets.length) {
        finished.push(frame.id);
        stack.pop();
      } else {
        const target = targets[frame.next++];
        if (!visited.has(target)) {
          visited.add(target);
          stack.push({ id: target, next: 0 });
        }
      }
    }
  }
  const componentOfCourse = new Map<string, string>();
  const components: CorequisiteComponent[] = [];
  for (const root of finished.reverse()) {
    if (componentOfCourse.has(root)) continue;
    const members: string[] = [];
    const pending = [root];
    componentOfCourse.set(root, root);
    while (pending.length) {
      const id = pending.pop()!;
      members.push(id);
      for (const target of reverse.get(id)!)
        if (!componentOfCourse.has(target)) {
          componentOfCourse.set(target, root);
          pending.push(target);
        }
    }
    members.sort(compareCodepoints);
    members.forEach((id) => componentOfCourse.set(id, members[0]));
    components.push({
      id: members[0],
      courseIds: members,
      dependencyComponentIds: [],
    });
  }
  const condensed = components
    .map((component) => ({
      ...component,
      dependencyComponentIds: [
        ...new Set(
          component.courseIds.flatMap((id) =>
            edges.get(id)!.map((target) => componentOfCourse.get(target)!),
          ),
        ),
      ]
        .filter((id) => id !== component.id)
        .sort(compareCodepoints),
    }))
    .sort((left, right) => compareCodepoints(left.id, right.id));
  const dependencyFirstOrder: string[] = [];
  const done = new Set<string>();
  while (done.size < condensed.length)
    for (const component of condensed) {
      if (
        !done.has(component.id) &&
        component.dependencyComponentIds.every((id) => done.has(id))
      ) {
        dependencyFirstOrder.push(component.id);
        done.add(component.id);
      }
    }
  return { components: condensed, componentOfCourse, dependencyFirstOrder };
}

export function corequisitePath(
  requirements: ReadonlyMap<string, readonly string[]>,
  fromCourseId: string,
  toCourseId: string,
): readonly string[] {
  const sorted = new Map(
    [...requirements].map(([id, targets]) => [
      id,
      [...targets].sort(compareCodepoints),
    ]),
  );
  return corequisitePaths(sorted, fromCourseId).get(toCourseId) ?? [];
}

export function corequisitePaths(
  requirements: ReadonlyMap<string, readonly string[]>,
  fromCourseId: string,
): ReadonlyMap<string, readonly string[]> {
  const parent = new Map<string, string | null>([[fromCourseId, null]]);
  const queue = [fromCourseId];
  const paths = new Map<string, readonly string[]>();
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    const path: string[] = [];
    let current: string | null = id;
    while (current !== null) {
      path.push(current);
      current = parent.get(current)!;
    }
    paths.set(id, path.reverse());
    for (const target of requirements.get(id) ?? [])
      if (!parent.has(target)) {
        parent.set(target, id);
        queue.push(target);
      }
  }
  return paths;
}
