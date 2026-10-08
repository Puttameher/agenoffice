/**
 * Realistic Office Pathfinding & Navigation Graph
 * Directs characters and pets through realistic room doorways and around desks & solid walls.
 */

// Central hall & room boundary references (default world coordinates)
export const NAV_ZONES = {
  LOUNGE: "LOUNGE",
  CEO_SUITE: "CEO_SUITE",
  SERVER_ROOM: "SERVER_ROOM",
  TEA_BREAK: "TEA_BREAK",
  COURTYARD: "COURTYARD",
  ENTRANCE: "ENTRANCE",
  CENTRAL_HALL: "CENTRAL_HALL"
};

/**
 * Determine which zone an (x, y) coordinate falls into
 */
export function getNavZone(x, y) {
  // Left Wing: Lounge & Break Hub (x: 0..276, y: 0..286)
  if (x < 276 && y < 286) {
    return NAV_ZONES.LOUNGE;
  }
  // CEO Suite (x: 503..863, y: 0..226)
  if (x >= 503 && x <= 863 && y < 226) {
    return NAV_ZONES.CEO_SUITE;
  }
  // Right Wing Upper: Server Room (x >= 1070, y < 206)
  if (x >= 1070 && y < 206) {
    return NAV_ZONES.SERVER_ROOM;
  }
  // Right Wing Middle: Tea Break Lounge & Context Synthesizer (x >= 1070, y: 206..406)
  if (x >= 1070 && y >= 206 && y < 406) {
    return NAV_ZONES.TEA_BREAK;
  }
  // Right Wing Lower: Courtyard Nature Garden (x >= 1070, y >= 406)
  if (x >= 1070 && y >= 406) {
    return NAV_ZONES.COURTYARD;
  }
  // Entrance Foyer (x: 573..793, y >= 535)
  if (x >= 573 && x <= 793 && y >= 535) {
    return NAV_ZONES.ENTRANCE;
  }
  // All other open floor space belongs to the Central Hall
  return NAV_ZONES.CENTRAL_HALL;
}

// Doorway Portal nodes: { inside: {x,y}, outside: {x,y} }
export const DOOR_PORTALS = {
  LOUNGE: {
    inside: { x: 245, y: 131 },
    outside: { x: 310, y: 131 }
  },
  SERVER_ROOM: {
    inside: { x: 1115, y: 150 },
    outside: { x: 1040, y: 150 }
  },
  TEA_BREAK: {
    inside: { x: 1115, y: 310 },
    outside: { x: 1040, y: 310 }
  },
  COURTYARD: {
    inside: { x: 1120, y: 450 },
    outside: { x: 1040, y: 450 }
  },
  CEO_SUITE_L: {
    inside: { x: 525, y: 195 },
    outside: { x: 525, y: 245 }
  },
  CEO_SUITE_R: {
    inside: { x: 840, y: 195 },
    outside: { x: 840, y: 245 }
  },
  ENTRANCE: {
    inside: { x: 683, y: 580 },
    outside: { x: 683, y: 510 }
  }
};

// Desk Bounding Boxes (table surfaces & monitors to NEVER walk across)
export const DESK_OBSTACLES = [
  // Desk 1 (Row 1 Left): table rect [347, 262, 533, 326], chair at (440, 334), aisle at (440, 370)
  { id: 1, x1: 345, y1: 250, x2: 535, y2: 330, chair: { x: 440, y: 334 }, aisle: { x: 440, y: 370 } },
  // Desk 2 (Row 1 Middle): table rect [590, 262, 776, 326], chair at (683, 334), aisle at (683, 370)
  { id: 2, x1: 588, y1: 250, x2: 778, y2: 330, chair: { x: 683, y: 334 }, aisle: { x: 683, y: 370 } },
  // Desk 3 (Row 1 Right): table rect [833, 262, 1019, 326], chair at (926, 334), aisle at (926, 370)
  { id: 3, x1: 830, y1: 250, x2: 1022, y2: 330, chair: { x: 926, y: 334 }, aisle: { x: 926, y: 370 } },
  // Desk 4 (Row 2 Left): table rect [347, 417, 533, 481], chair at (440, 489), aisle at (440, 510)
  { id: 4, x1: 345, y1: 405, x2: 535, y2: 485, chair: { x: 440, y: 489 }, aisle: { x: 440, y: 510 } },
  // Desk 5 (Row 2 Middle): table rect [590, 417, 776, 481], chair at (683, 489), aisle at (683, 510)
  { id: 5, x1: 588, y1: 405, x2: 778, y2: 485, chair: { x: 683, y: 489 }, aisle: { x: 683, y: 510 } },
  // Desk 6 (Row 2 Right): table rect [833, 417, 1019, 481], chair at (926, 489), aisle at (926, 510)
  { id: 6, x1: 830, y1: 405, x2: 1022, y2: 485, chair: { x: 926, y: 489 }, aisle: { x: 926, y: 510 } }
];

/**
 * Check if a 2D line segment between (p1x, p1y) and (p2x, p2y) intersects a rectangle
 */
function lineIntersectsBox(p1x, p1y, p2x, p2y, box) {
  // If both points are entirely on one side of the box, no intersection
  if (Math.max(p1x, p2x) < box.x1 || Math.min(p1x, p2x) > box.x2) return false;
  if (Math.max(p1y, p2y) < box.y1 || Math.min(p1y, p2y) > box.y2) return false;

  // Helper: line segment intersection
  const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  const segsIntersect = (ax, ay, bx, by, cx, cy, dx, dy) =>
    ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
    ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy);

  // Check all 4 box edges
  if (segsIntersect(p1x, p1y, p2x, p2y, box.x1, box.y1, box.x2, box.y1)) return true;
  if (segsIntersect(p1x, p1y, p2x, p2y, box.x2, box.y1, box.x2, box.y2)) return true;
  if (segsIntersect(p1x, p1y, p2x, p2y, box.x2, box.y2, box.x1, box.y2)) return true;
  if (segsIntersect(p1x, p1y, p2x, p2y, box.x1, box.y2, box.x1, box.y1)) return true;

  // Check if either point is strictly inside the box
  if (p1x >= box.x1 && p1x <= box.x2 && p1y >= box.y1 && p1y <= box.y2) return true;
  if (p2x >= box.x1 && p2x <= box.x2 && p2y >= box.y1 && p2y <= box.y2) return true;

  return false;
}

/**
 * Check if a direct line between two points cuts across any desk table
 */
export function lineHitsAnyDesk(p1x, p1y, p2x, p2y) {
  for (const desk of DESK_OBSTACLES) {
    if (lineIntersectsBox(p1x, p1y, p2x, p2y, desk)) return true;
  }
  return false;
}

/**
 * Waypoint graph in the Central Hall.
 * All corridors (y=245, y=370, y=510) and aisles (x=310, 560, 683, 805, 1040)
 * strictly avoid all desks, laptops, and walls.
 */
const GRAPH_NODES = {
  // North Corridor (y = 245) - Passes north of Row 1 desks (which start at y=250)
  N_WEST: { x: 310, y: 245, neighbors: ["N_CEO_L", "W_LOUNGE", "M_WEST"] },
  N_CEO_L: { x: 525, y: 245, neighbors: ["N_WEST", "N_A1"] },
  N_A1: { x: 560, y: 245, neighbors: ["N_CEO_L", "N_MID", "M_A1"] },
  N_MID: { x: 683, y: 245, neighbors: ["N_A1", "N_A2"] },
  N_A2: { x: 805, y: 245, neighbors: ["N_MID", "N_CEO_R", "M_A2"] },
  N_CEO_R: { x: 840, y: 245, neighbors: ["N_A2", "N_EAST"] },
  N_EAST: { x: 1040, y: 245, neighbors: ["N_CEO_R", "E_SERVER", "M_EAST"] },

  // Middle Corridor between Desk Row 1 and Row 2 (y = 370)
  M_WEST: { x: 310, y: 370, neighbors: ["N_WEST", "M_D1", "S_WEST"] },
  M_D1: { x: 440, y: 370, neighbors: ["M_WEST", "M_A1", "DESK_1_SEAT"] },
  M_A1: { x: 560, y: 370, neighbors: ["M_D1", "M_MID", "N_A1", "S_A1"] },
  M_MID: { x: 683, y: 370, neighbors: ["M_A1", "M_A2", "S_MID", "DESK_2_SEAT"] },
  M_A2: { x: 805, y: 370, neighbors: ["M_MID", "M_D3", "N_A2", "S_A2"] },
  M_D3: { x: 926, y: 370, neighbors: ["M_A2", "M_EAST", "DESK_3_SEAT"] },
  M_EAST: { x: 1040, y: 370, neighbors: ["M_D3", "N_EAST", "S_EAST", "E_TEA"] },

  // South Corridor below Desk Row 2 (y = 510)
  S_WEST: { x: 310, y: 510, neighbors: ["M_WEST", "S_D4", "W_TASK_BOARD"] },
  S_D4: { x: 440, y: 510, neighbors: ["S_WEST", "S_A1", "DESK_4_SEAT"] },
  S_A1: { x: 560, y: 510, neighbors: ["S_D4", "S_MID", "M_A1"] },
  S_MID: { x: 683, y: 510, neighbors: ["S_A1", "S_A2", "M_MID", "DESK_5_SEAT", "OUT_ENTRANCE"] },
  S_A2: { x: 805, y: 510, neighbors: ["S_MID", "S_D6", "M_A2"] },
  S_D6: { x: 926, y: 510, neighbors: ["S_A2", "S_EAST", "DESK_6_SEAT"] },
  S_EAST: { x: 1040, y: 510, neighbors: ["S_D6", "M_EAST", "E_GARDEN"] },

  // External Portal Hallway Nodes
  W_LOUNGE: { x: 310, y: 131, neighbors: ["N_WEST"] },
  W_TASK_BOARD: { x: 310, y: 420, neighbors: ["S_WEST", "M_WEST"] },
  E_SERVER: { x: 1040, y: 150, neighbors: ["N_EAST"] },
  E_TEA: { x: 1040, y: 310, neighbors: ["N_EAST", "M_EAST"] },
  E_GARDEN: { x: 1040, y: 450, neighbors: ["M_EAST", "S_EAST"] },
  OUT_ENTRANCE: { x: 683, y: 510, neighbors: ["S_MID"] },

  // Desk Chair Seating Nodes (Only accessible via their south aisle waypoints!)
  DESK_1_SEAT: { x: 440, y: 334, neighbors: ["M_D1"] },
  DESK_2_SEAT: { x: 683, y: 334, neighbors: ["M_MID"] },
  DESK_3_SEAT: { x: 926, y: 334, neighbors: ["M_D3"] },
  DESK_4_SEAT: { x: 440, y: 489, neighbors: ["S_D4"] },
  DESK_5_SEAT: { x: 683, y: 489, neighbors: ["S_MID"] },
  DESK_6_SEAT: { x: 926, y: 489, neighbors: ["S_D6"] }
};

/**
 * Find the closest graph node to any given point in the central hall
 */
function findNearestGraphNode(x, y, exclude = []) {
  let bestKey = null;
  let bestDist = Infinity;
  for (const [key, node] of Object.entries(GRAPH_NODES)) {
    if (exclude.includes(key)) continue;
    // Don't choose desk seats as generic entry nodes
    if (key.endsWith("_SEAT")) continue;
    const d = Math.hypot(x - node.x, y - node.y);
    if (d < bestDist) {
      bestDist = d;
      bestKey = key;
    }
  }
  return bestKey;
}

/**
 * Dijkstra shortest path on GRAPH_NODES
 */
function searchGraph(startKey, endKey) {
  if (startKey === endKey) return [GRAPH_NODES[startKey]];

  const dist = {};
  const prev = {};
  const unvisited = new Set(Object.keys(GRAPH_NODES));

  for (const key of unvisited) {
    dist[key] = Infinity;
  }
  dist[startKey] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let minDist = Infinity;
    for (const key of unvisited) {
      if (dist[key] < minDist) {
        minDist = dist[key];
        current = key;
      }
    }

    if (current === null || current === endKey || minDist === Infinity) {
      break;
    }

    unvisited.delete(current);
    const currNode = GRAPH_NODES[current];

    for (const neighborKey of currNode.neighbors) {
      if (!unvisited.has(neighborKey)) continue;
      const neighborNode = GRAPH_NODES[neighborKey];
      const edgeWeight = Math.hypot(currNode.x - neighborNode.x, currNode.y - neighborNode.y);
      const alt = dist[current] + edgeWeight;
      if (alt < dist[neighborKey]) {
        dist[neighborKey] = alt;
        prev[neighborKey] = current;
      }
    }
  }

  if (dist[endKey] === Infinity) {
    return [GRAPH_NODES[startKey], GRAPH_NODES[endKey]];
  }

  // Backtrack path
  const path = [];
  let u = endKey;
  while (u) {
    path.unshift(GRAPH_NODES[u]);
    u = prev[u];
  }
  return path;
}

/**
 * Find desk obstacle matching a chair location
 */
function findDeskByChair(x, y, radius = 32) {
  return DESK_OBSTACLES.find(d => Math.hypot(x - d.chair.x, y - d.chair.y) <= radius);
}

/**
 * Path simplification: remove redundant collinear intermediate waypoints
 * without clipping through any desks or solid obstacles
 */
function smoothPath(waypoints) {
  if (waypoints.length <= 2) return waypoints;

  const result = [waypoints[0]];
  for (let i = 1; i < waypoints.length - 1; i++) {
    const p0 = result[result.length - 1];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];

    // Collinear horizontal
    const isCollinearH = Math.abs(p0.y - p1.y) < 1 && Math.abs(p1.y - p2.y) < 1;
    // Collinear vertical
    const isCollinearV = Math.abs(p0.x - p1.x) < 1 && Math.abs(p1.x - p2.x) < 1;

    // Never smooth over a waypoint if the shortcut cuts across any desk or table
    if (lineHitsAnyDesk(p0.x, p0.y, p2.x, p2.y)) {
      result.push(p1);
      continue;
    }

    if (!isCollinearH && !isCollinearV) {
      result.push(p1);
    }
  }
  result.push(waypoints[waypoints.length - 1]);
  return result;
}

/**
 * Main Pathfinding Entry Point:
 * Generates an obstacle-free series of waypoints from (fromX, fromY) to (toX, toY).
 * Strictly routes characters through aisle walkways (y=370, y=510), ensuring
 * they never step on desks, laptops, or monitors.
 */
export function findOfficePath(fromX, fromY, toX, toY) {
  const fromZone = getNavZone(fromX, fromY);
  const toZone = getNavZone(toX, toY);

  // 1. Same Room: Move directly with line of sight (except Central Hall with desks)
  if (fromZone === toZone && fromZone !== NAV_ZONES.CENTRAL_HALL) {
    return [{ x: toX, y: toY }];
  }

  const rawWaypoints = [];
  let currentPos = { x: fromX, y: fromY };

  // 2. Desk Exit Safety: If starting at a workstation chair, step SOUTH into the aisle corridor first!
  const startDesk = findDeskByChair(fromX, fromY);
  if (startDesk) {
    rawWaypoints.push({ x: startDesk.aisle.x, y: startDesk.aisle.y });
    currentPos = { x: startDesk.aisle.x, y: startDesk.aisle.y };
  }

  // 3. If starting inside an enclosed room, first navigate to that room's doorway portal
  if (fromZone !== NAV_ZONES.CENTRAL_HALL) {
    let portal = null;
    if (fromZone === NAV_ZONES.LOUNGE) portal = DOOR_PORTALS.LOUNGE;
    else if (fromZone === NAV_ZONES.SERVER_ROOM) portal = DOOR_PORTALS.SERVER_ROOM;
    else if (fromZone === NAV_ZONES.TEA_BREAK) portal = DOOR_PORTALS.TEA_BREAK;
    else if (fromZone === NAV_ZONES.COURTYARD) portal = DOOR_PORTALS.COURTYARD;
    else if (fromZone === NAV_ZONES.ENTRANCE) portal = DOOR_PORTALS.ENTRANCE;
    else if (fromZone === NAV_ZONES.CEO_SUITE) {
      portal = Math.abs(fromX - DOOR_PORTALS.CEO_SUITE_L.inside.x) < Math.abs(fromX - DOOR_PORTALS.CEO_SUITE_R.inside.x)
        ? DOOR_PORTALS.CEO_SUITE_L
        : DOOR_PORTALS.CEO_SUITE_R;
    }

    if (portal) {
      rawWaypoints.push({ x: portal.inside.x, y: portal.inside.y });
      rawWaypoints.push({ x: portal.outside.x, y: portal.outside.y });
      currentPos = portal.outside;
    }
  }

  // 4. Central Hallway Navigation
  let destinationNodePos = { x: toX, y: toY };
  const pendingRoomSteps = [];

  // Desk Entry Safety: If destination is a workstation chair, route via south aisle first!
  const endDesk = findDeskByChair(toX, toY);
  if (endDesk) {
    destinationNodePos = { x: endDesk.aisle.x, y: endDesk.aisle.y };
    pendingRoomSteps.push({ x: endDesk.aisle.x, y: endDesk.aisle.y });
    pendingRoomSteps.push({ x: toX, y: toY });
  } else if (toZone !== NAV_ZONES.CENTRAL_HALL) {
    // If destination is inside a room, determine which door to enter through
    let targetPortal = null;
    if (toZone === NAV_ZONES.LOUNGE) targetPortal = DOOR_PORTALS.LOUNGE;
    else if (toZone === NAV_ZONES.SERVER_ROOM) targetPortal = DOOR_PORTALS.SERVER_ROOM;
    else if (toZone === NAV_ZONES.TEA_BREAK) targetPortal = DOOR_PORTALS.TEA_BREAK;
    else if (toZone === NAV_ZONES.COURTYARD) targetPortal = DOOR_PORTALS.COURTYARD;
    else if (toZone === NAV_ZONES.ENTRANCE) targetPortal = DOOR_PORTALS.ENTRANCE;
    else if (toZone === NAV_ZONES.CEO_SUITE) {
      targetPortal = Math.abs(currentPos.x - DOOR_PORTALS.CEO_SUITE_L.outside.x) < Math.abs(currentPos.x - DOOR_PORTALS.CEO_SUITE_R.outside.x)
        ? DOOR_PORTALS.CEO_SUITE_L
        : DOOR_PORTALS.CEO_SUITE_R;
    }

    if (targetPortal) {
      destinationNodePos = targetPortal.outside;
      pendingRoomSteps.push({ x: targetPortal.inside.x, y: targetPortal.inside.y });
      pendingRoomSteps.push({ x: toX, y: toY });
    }
  }

  // Route through central hall waypoint graph
  const startGraphKey = findNearestGraphNode(currentPos.x, currentPos.y);
  const endGraphKey = findNearestGraphNode(destinationNodePos.x, destinationNodePos.y);

  if (startGraphKey && endGraphKey) {
    const graphSteps = searchGraph(startGraphKey, endGraphKey);
    for (const pt of graphSteps) {
      rawWaypoints.push({ x: pt.x, y: pt.y });
    }
  }

  // Append pending doorway/aisle and final steps
  for (const step of pendingRoomSteps) {
    rawWaypoints.push(step);
  }

  // Always ensure final destination is the exact target
  if (rawWaypoints.length === 0 || rawWaypoints[rawWaypoints.length - 1].x !== toX || rawWaypoints[rawWaypoints.length - 1].y !== toY) {
    rawWaypoints.push({ x: toX, y: toY });
  }

  // Smooth path to remove redundant collinear nodes without clipping desks
  return smoothPath(rawWaypoints);
}
