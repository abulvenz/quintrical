import m from "mithril";
import tagl from "tagl-mithril";
import { parts } from "./parts";

const { random, min, max, trunc, floor } = Math;
const {
  div,
  table,
  tr,
  td,
  ul,
  li,
  pre,
  hr,
  button,
  label,
  input,
  span,
  h1,
  select,
  option,
  br,
} = tagl(m);

const use = (v, f) => f(v);

const WIDTH = 20;
const HEIGHT = 20;

const range2 = (N) => {
  const r = [];
  for (let i = 0; i < N; i++) r.push(i);
  return r;
};

const range = (() => {
  let r = range2(2000);
  return (N) => {
    if (r.length < N) r = range2(N);
    return r.slice(0, N);
  };
})();

const isDivisible = (n, d) => n % d === 0;
const identity = (e) => e;

const sorted = (arr, comparison) => arr.map(identity).sort(comparison);

const compare = (a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

/**
 * Rotate a shape counterclockwise by 90°
 */
const rotatePoint = (p) => [-p[1], p[0]];
const rotate = (shape) => ({
  ...shape,
  coords: shape.coords.map(rotatePoint).sort(compare),
});

const flipPoint = (p) => [p[0], -p[1]];

const flip = (shape) => ({
  ...shape,
  coords: shape.coords.map(flipPoint).sort(compare),
});

const normalizePoint = (p0) => (p) => [p[0] - p0[0], p[1] - p0[1]];

const normalize = (shape, offset = shape.coords[0]) => ({
  ...shape,
  coords: shape.coords.map(normalizePoint(offset)),
});

const isEqualPoint = (p0, p1) => p0[0] === p1[0] && p0[1] === p1[1];

const isEqual = (shapeA, shapeB) =>
  shapeA.coords.length === shapeB.coords.length &&
  shapeA.coords.every((p, idx) => isEqualPoint(p, shapeB.coords[idx]));

const printShape = (shape) => {
  const minRow = min(...shape.coords.map((p) => p[0]));
  const maxRow = max(...shape.coords.map((p) => p[0]));
  const minCol = min(...shape.coords.map((p) => p[1]));
  const maxCol = max(...shape.coords.map((p) => p[1]));

  const result = range(maxRow - minRow + 1).map((rows) =>
    range(maxCol - minCol + 1).map((col) => " ")
  );

  shape.coords.forEach((p) => (result[p[0] - minRow][p[1] - minCol] = "▣"));
  return result.map((r) => r.join("")).join("\n");
};

const permutations = [
  [identity],
  [rotate, normalize],
  [rotate, rotate, normalize],
  [rotate, rotate, rotate, normalize],
  [flip, normalize],
  [flip, rotate, normalize],
  [flip, rotate, rotate, normalize],
  [flip, rotate, rotate, rotate, normalize],
];

const findValidTransformations = (shape) => {
  const result = [];

  permutations.forEach((perm) => {
    const newTransformation = perm.reduce((acc, v) => (acc = v(acc)), shape);

    if (!result.some((trans) => isEqual(trans, newTransformation))) {
      result.push(newTransformation);
    }
  });
  return result;
};

parts.forEach((part) => {
  part.validTransformations = findValidTransformations(part);
});

const player = (color, startField, parts) => ({
  color,
  startField,
  parts: parts.slice(0, parts.length),
});

const createPlayers = () => [
  player("red", [0, 0], parts),
  player("green", [HEIGHT - 1, 0], parts),
  player("yellow", [HEIGHT - 1, WIDTH - 1], parts),
  player("blue", [0, WIDTH - 1], parts),
];

let players = createPlayers();

console.log(players);

const createField = () =>
  range(WIDTH * HEIGHT).map((idx) => ({
    color: undefined,
    idx,
  }));

let field = createField();

console.log(field);

const fRC = (row, col) => field[row * WIDTH + col];

const coords = (idx) => ({ row: floor(idx / WIDTH), col: idx % WIDTH });
const index = (row, col) => row * WIDTH + col;

const onBoard = (row, col) =>
  row >= 0 && row < HEIGHT && col >= 0 && col < WIDTH;

const plusNeighbors = (row, col) =>
  [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter((p) => onBoard(...p));
const xNeighbors = (row, col) =>
  [
    [row - 1, col - 1],
    [row + 1, col - 1],
    [row + 1, col + 1],
    [row - 1, col + 1],
  ].filter((p) => onBoard(...p));

const hasColor = (c, field) => field.color === c;

const isEmpty = (field) => field.color === undefined;

const validFields = (player) =>
  use(
    field
      //.filter((f) => isEmpty(f))
      .filter((f, idx) =>
        use(
          coords(idx),
          (fCoords) =>
            isEmpty(f) &&
            xNeighbors(fCoords.row, fCoords.col).some((n) =>
              hasColor(player.color, fRC(...n))
            ) &&
            plusNeighbors(fCoords.row, fCoords.col).every(
              (n) => !hasColor(player.color, fRC(...n))
            )
        )
      )
      .map((f) => f.idx)
      .filter((e) => !!e),
    (validFields) =>
      validFields.length > 0 ? validFields : [fRC(...player.startField).idx]
  );

const randomElement = (arr) => arr[trunc(random() * arr.length)];

const shuffled = (arr, result = []) =>
  arr.length === 0
    ? result
    : use(arr.splice(trunc(random() * arr.length), 1), (elem) =>
        shuffled(arr, [...result, elem[0]])
      );

console.log("shuffled", shuffled([0, 1, 2, 3]));

// field[100] = { color: "red" };
//field[137] = { color: "red" };
let p0Fields = validFields(players[0]);

const placePart = (color, part) =>
  part.coords.forEach((p) => (fRC(...p).color = color));

const canPlace = (row, col, part, player) => {
  const result = [];
  const before = validFields(player);
  const beforeOthers = players
    .filter((p) => p !== player)
    .map(validFields)
    .reduce((acc, v) => acc + v, 0);

  part.validTransformations.filter((shape) => {
    shape.coords.forEach((c) => {
      const shifted = normalize(shape, [c[0] - row, c[1] - col]);
      if (
        shifted.coords.every(
          (p) =>
            onBoard(...p) &&
            isEmpty(fRC(...p)) &&
            plusNeighbors(...p).every((n) => !hasColor(player.color, fRC(...n)))
        )
      ) {
        placePart(player.color, shifted);

        const after = validFields(player);
        const afterOthers = players
          .filter((p) => p !== player)
          .map(validFields)
          .reduce((acc, v) => acc + v, 0);

        placePart(undefined, shifted);

        shifted.diff = after.length - before.length;
        shifted.otherDiff = afterOthers.length - beforeOthers.length;

        shifted.part = part;
        result.push(shifted);
      }
    });
  });
  return result;
};

const move = (player) => {
  let pFields = validFields(player);

  if (pFields.length === 0) {
    console.log("No options for player " + player.color);
    return false;
  }

  let possibilities = [];

  pFields.map(coords).forEach((f) => {
    player.parts.forEach((part) => {
      const possibilitiess = canPlace(f.row, f.col, part, player);

      possibilities = possibilities.concat(possibilitiess);
    });
  });

  player.possibilities = possibilities.length;

  if (possibilities.length === 0) {
    console.log(
      "GAME OVER " +
        player.color +
        " LEFT OVER " +
        (player.residual = player.parts
          .map((p) => p.coords.length)
          .reduce((acc, v) => acc + v, 0))
    );
    return false;
  }

  const possibilityNum = trunc(random() * possibilities.length);
  placePart(player.color, possibilities[possibilityNum]);

  player.parts.splice(
    player.parts.indexOf(possibilities[possibilityNum].part),
    1
  );
  return true;
};

let step = 0;
let currentPlayer = 0;
let inGame = 0;

const runStep = () => {
  if (currentPlayer === 0) {
    inGame = 0;
  }

  inGame += move(players[currentPlayer]) ? 1 : 0;
  m.redraw();

  if (
    automatic &&
    (currentPlayer !== players.length - 1 || inGame > 0) &&
    step < players.length * parts.length + 10
  ) {
    setTimeout(runStep, 0);
  } else if (currentPlayer !== players.length - 1) {
    console.log(
      "InGame " + inGame,
      "Step " + step + "/" + players.length * parts.length
    );
  }
  step += 1;
  currentPlayer = (currentPlayer + 1) % players.length;
  selectedField = -1;
  selectedPossibility = undefined;
  playerPossibilities = [];
};

let automatic = false;

let selectedField = -1;
let selectedPossibility = undefined;

const clear = () => {
  automatic = false;
  players = createPlayers();
  field = createField();
  step = 0;
  currentPlayer = 0;
  inGame = 0;
  selectedField = -1;
  selectedPossibility = undefined;
  playerPossibilities = [];
};

let playerPossibilities = [];

const contains = (row, col, part) =>
  part.coords.find((p) => p[0] === row && p[1] === col) !== undefined;

const game = () => ({});

m.mount(document.body, {
  view: (vnode) =>
    div.container(
      h1("Quintrical"),
      selectedPossibility ? pre(printShape(selectedPossibility)) : null,
      table(
        tr(
          td(
            use(validFields(players[currentPlayer]), (pFields) =>
              table.game(
                range(HEIGHT).map((row) =>
                  tr.game(
                    range(WIDTH).map((col) =>
                      use(
                        pFields.find((fidx) => fidx === index(row, col)) !==
                          undefined,
                        (validField) =>
                          td.game[
                            selectedPossibility &&
                            contains(row, col, selectedPossibility)
                              ? "selectedPossibility"
                              : validField
                              ? "player.blink"
                              : ""
                          ][fRC(row, col).color][
                            selectedPossibility === undefined &&
                            selectedField === index(row, col)
                              ? "selected"
                              : ""
                          ]({
                            onclick: (e) =>
                              validField
                                ? (selectedField = index(row, col))
                                : null,
                          })
                      )
                    )
                  )
                )
              )
            )
          ),
          td(
            table(
              use(players[currentPlayer].parts, (parts) =>
                range(parts.length / 4).map((row) =>
                  tr(
                    range(4).map((col) =>
                      td(
                        use(parts[row * 4 + col], (part) =>
                          button[players[currentPlayer].color](
                            {
                              onclick: (e) => {
                                if (selectedField >= 0) {
                                  const c = coords(selectedField);
                                  playerPossibilities = canPlace(
                                    c.row,
                                    c.col,
                                    part,
                                    players[currentPlayer]
                                  );
                                  selectedPossibility = playerPossibilities[0];
                                }
                              },
                            },
                            pre(printShape(part))
                          )
                        )
                      )
                    )
                  )
                )
              ),
              select(
                {
                  oninput: (e) =>
                    (selectedPossibility =
                      playerPossibilities[+e.target.value]),
                },
                playerPossibilities.map((possibility, idx) =>
                  option(
                    {
                      value: idx,
                      onclick: (e) => {
                        selectedPossibility = playerPossibilities[idx];
                      },
                    },
                    idx
                  )
                )
              ),
              selectedPossibility
                ? button(
                    {
                      onclick: (e) => {
                        placePart(
                          players[currentPlayer].color,
                          selectedPossibility
                        );
                        players[currentPlayer].parts.splice(
                          players[currentPlayer].parts.indexOf(
                            selectedPossibility.part
                          ),
                          1
                        );
                        selectedPossibility = undefined;
                        currentPlayer = (currentPlayer + 1) % players.length;
                        playerPossibilities = [];
                        selectedField = -1;
                      },
                    },
                    "Place!"
                  )
                : null
            )
          )
        ),
        tr(
          td(
            label.switch(
              input({
                checked: automatic,
                type: "checkbox",
                onchange: (e) => (automatic = e.target.checked) && runStep(),
              }),
              span.slider.round()
            ),
            "Automatic"
          ),
          button({ onclick: runStep }, "Next step"),
          button({ onclick: clear }, "Clear")
        )
      ),
      ul(
        sorted(players, (a, b) => a.residual - b.residual).map((player) => [
          player.residual
            ? li("Residual " + player.color + ": " + player.residual)
            : li(
                "Valid fields " +
                  player.color +
                  ": " +
                  validFields(player).length
              ),
        ])
      ),
      hr(),
      ul(
        sorted(players, (a, b) => a.residual - b.residual).map((player) => [
          li(
            player.color +
              " has " +
              player.parts.length +
              " pieces to place, number of possibilities " +
              player.possibilities,
            table(
              tr(
                player.parts.map((part) =>
                  td(pre[player.color](printShape(part)))
                )
              )
            )
          ),
        ])
      )
    ),
});
