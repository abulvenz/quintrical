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

const WIDTH = 21;
const HEIGHT = 21;

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

const randomElement = (arr) => arr[trunc(random() * arr.length)];

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

const shiftPoint = (p0) => (p) => [p[0] - p0[0], p[1] - p0[1]];

const shift = (shape, offset) => ({
  ...shape,
  coords: shape.coords.map(shiftPoint(offset)),
});

const normalize = (shape) => shift(shape, shape.coords[0]);

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

const transformations = [
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

  transformations.forEach((perm) => {
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

const createField = () =>
  range(WIDTH * HEIGHT).map((idx) => ({
    color: undefined,
    idx,
  }));

let step = 0;
let inGame = 0;
let automatic = false;

let state = {
  players: createPlayers(),
  field: createField(),
  currentPlayer: -1,
  selectedField: -1,
  selectedPossibility: undefined,
  playerPossibilities: [],
  pFields: [],
  selectedPart: undefined,
  nextPlayer: () => {
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
    state.selectedPossibility = undefined;
    state.playerPossibilities = [];
    state.selectedField = -1;
    state.selectedPart =
      state.players[state.currentPlayer].parts[
        state.players[state.currentPlayer].parts.length - 1
      ];
    state.pFields = validFields(state.players[state.currentPlayer]);
    state.selectedField =
      state.pFields[0] !== undefined ? state.pFields[0] : -1;
    state.calculatePossiblePlacements();
  },
  selectField: (idx) => {
    state.selectedField = idx;
    state.calculatePossiblePlacements();
  },
  calculatePossiblePlacements: () => {
    if (state.selectedField >= 0 && state.selectedPart !== undefined) {
      const c = rcOfIdx(state.selectedField);
      state.playerPossibilities = canPlace(
        c.row,
        c.col,
        state.selectedPart,
        state.players[state.currentPlayer]
      );
      state.selectedPossibility = state.playerPossibilities[0];
    }
  },
  selectPart: (part) => {
    state.selectedPart = part;
    state.calculatePossiblePlacements();
  },
};

const fieldAtRC = (row, col) => state.field[row * WIDTH + col];

const rcOfIdx = (idx) => ({ row: floor(idx / WIDTH), col: idx % WIDTH });
const indexOfRC = (row, col) => row * WIDTH + col;

const onBoardRC = (row, col) =>
  row >= 0 && row < HEIGHT && col >= 0 && col < WIDTH;

/**
 * Creates an array of [row, column] array that are
 * adjacent to the given row and column and north, south,
 * east and west of it and still on the field
 */
const plusNeighbors = (row, col) =>
  [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter((p) => onBoardRC(...p));

/**
 * Creates an array of [row, column] array that are
 * adjacent to the given row and column and north-west, north-east,
 * south-west and south-east of it and still on the field
 */
const xNeighbors = (row, col) =>
  [
    [row - 1, col - 1],
    [row + 1, col - 1],
    [row + 1, col + 1],
    [row - 1, col + 1],
  ].filter((p) => onBoardRC(...p));

const fieldHasColor = (c, field) => field.color === c;

const isEmptyField = (field) => field.color === undefined;

const validFields = (player) =>
  use(
    state.field
      .filter((f, idx) =>
        use(
          rcOfIdx(idx),
          (fCoords) =>
            isEmptyField(f) &&
            xNeighbors(fCoords.row, fCoords.col).some((n) =>
              fieldHasColor(player.color, fieldAtRC(...n))
            ) &&
            plusNeighbors(fCoords.row, fCoords.col).every(
              (n) => !fieldHasColor(player.color, fieldAtRC(...n))
            )
        )
      )
      .map((f) => f.idx)
      .filter((e) => !!e),
    (validFields) =>
      validFields.length > 0
        ? validFields
        : [fieldAtRC(...player.startField).idx]
  );

const shuffled = (arr, result = []) =>
  arr.length === 0
    ? result
    : use(arr.splice(trunc(random() * arr.length), 1), (elem) =>
        shuffled(arr, [...result, elem[0]])
      );

const placePart = (color, part) =>
  part.coords.forEach((p) => (fieldAtRC(...p).color = color));

const canPlace = (row, col, part, player) => {
  const result = [];
  const before = validFields(player);
  const beforeOthers = state.players
    .filter((p) => p !== player)
    .map(validFields)
    .reduce((acc, v) => acc + v, 0);

  part.validTransformations.filter((shape) => {
    shape.coords.forEach((c) => {
      const shifted = shift(shape, [c[0] - row, c[1] - col]);
      if (
        shifted.coords.every(
          (p) =>
            onBoardRC(...p) &&
            isEmptyField(fieldAtRC(...p)) &&
            plusNeighbors(...p).every(
              (n) => !fieldHasColor(player.color, fieldAtRC(...n))
            )
        )
      ) {
        placePart(player.color, shifted);

        const after = validFields(player);
        const afterOthers = state.players
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

  pFields.map(rcOfIdx).forEach((f) => {
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

const runStep = () => {
  if (state.currentPlayer === 0) {
    inGame = 0;
  }

  inGame += move(state.players[state.currentPlayer]) ? 1 : 0;
  m.redraw();

  if (
    automatic &&
    (state.currentPlayer !== state.players.length - 1 || inGame > 0) &&
    step < state.players.length * parts.length + 10
  ) {
    setTimeout(runStep, 0);
  } else if (state.currentPlayer !== state.players.length - 1) {
    console.log(
      "InGame " + inGame,
      "Step " + step + "/" + state.players.length * parts.length
    );
  }
  step += 1;
  state.nextPlayer();
};

const clear = () => {
  automatic = false;
  state.players = createPlayers();
  state.field = createField();
  step = 0;
  inGame = 0;
  state.currentPlayer = -1;
  state.nextPlayer();
};

const contains = (row, col, part) =>
  part.coords.find((p) => p[0] === row && p[1] === col) !== undefined;

const game = () => ({});

state.nextPlayer();

m.mount(document.body, {
  view: (vnode) =>
    div.container(
      h1("Quintrical"),
      table(
        tr(
          td(
            table.game(
              range(HEIGHT).map((row) =>
                tr.game(
                  range(WIDTH).map((col) =>
                    use(
                      state.pFields.find(
                        (fidx) => fidx === indexOfRC(row, col)
                      ) !== undefined,
                      (validField) =>
                        td.game[
                          state.selectedPossibility &&
                          contains(row, col, state.selectedPossibility)
                            ? "selectedPossibility"
                            : validField
                            ? "player.blink"
                            : ""
                        ][fieldAtRC(row, col).color][
                          state.selectedPossibility === undefined &&
                          state.selectedField === indexOfRC(row, col)
                            ? "selected"
                            : ""
                        ]({
                          onclick: (e) =>
                            validField
                              ? state.selectField(indexOfRC(row, col))
                              : null,
                        })
                    )
                  )
                )
              )
            )
          ),
          td(
            table(
              tr(
                td(
                  button.partButton(
                    {
                      onclick: (e) =>
                        use(
                          state.pFields.indexOf(state.selectedField) - 1,
                          (pfield) =>
                            use(
                              pfield >= 0 ? pfield : state.pFields.length - 1,
                              (pf) => state.selectField(state.pFields[pf])
                            )
                        ),
                    },
                    "<"
                  )
                ),
                td.partButton(
                  state.pFields.indexOf(state.selectedField) +
                    1 +
                    "/" +
                    state.pFields.length
                ),
                td(
                  button.partButton(
                    {
                      onclick: (e) =>
                        use(
                          (state.pFields.indexOf(state.selectedField) + 1) %
                            state.pFields.length,
                          (pf) => state.selectField(state.pFields[pf])
                        ),
                    },
                    ">"
                  )
                )
              )
            ),

            h1("Player " + state.players[state.currentPlayer].color),
            table(
              use(state.players[state.currentPlayer].parts, (parts) =>
                range(parts.length / 4 + 1).map((row) =>
                  tr(
                    range(4).map((col) =>
                      row * 4 + col <
                      state.players[state.currentPlayer].parts.length
                        ? td(
                            use(parts[row * 4 + col], (part) =>
                              button.partButton[
                                state.players[state.currentPlayer].color
                              ](
                                {
                                  onclick: (e) => {
                                    state.selectPart(part);
                                  },
                                },
                                pre(printShape(part))
                              )
                            )
                          )
                        : null
                    )
                  )
                )
              )
            ),
            h1("SOLO"),
            state.selectedPossibility
              ? [
                  table(
                    tr(
                      td(
                        button.partButton(
                          {
                            onclick: (e) =>
                              use(
                                state.playerPossibilities.indexOf(
                                  state.selectedPossibility
                                ) - 1,
                                (cidx) =>
                                  use(
                                    cidx >= state.playerPossibilities.length
                                      ? 0
                                      : cidx < 0
                                      ? state.playerPossibilities.length - 1
                                      : cidx,
                                    (ridx) =>
                                      (state.selectedPossibility =
                                        state.playerPossibilities[ridx])
                                  )
                              ),
                          },
                          "<"
                        )
                      ),
                      td(pre.partButton(printShape(state.selectedPossibility))),
                      td(
                        button.partButton(
                          {
                            onclick: (e) =>
                              use(
                                state.playerPossibilities.indexOf(
                                  state.selectedPossibility
                                ) + 1,
                                (cidx) =>
                                  use(
                                    cidx >= state.playerPossibilities.length
                                      ? 0
                                      : cidx < 0
                                      ? state.playerPossibilities.length - 1
                                      : cidx,
                                    (ridx) =>
                                      (state.selectedPossibility =
                                        state.playerPossibilities[ridx])
                                  )
                              ),
                          },
                          ">"
                        )
                      ),
                      td(
                        button.partButton(
                          {
                            onclick: (e) => {
                              placePart(
                                state.players[state.currentPlayer].color,
                                state.selectedPossibility
                              );
                              state.players[state.currentPlayer].parts.splice(
                                state.players[
                                  state.currentPlayer
                                ].parts.indexOf(state.selectedPossibility.part),
                                1
                              );
                              state.nextPlayer();
                            },
                          },
                          "Place!"
                        )
                      )
                    )
                  ),
                  state.playerPossibilities.indexOf(state.selectedPossibility) +
                    1 +
                    "/" +
                    state.playerPossibilities.length,
                ]
              : null,
            0 === 0
              ? null
              : select(
                  {
                    oninput: (e) =>
                      (state.selectedPossibility =
                        state.playerPossibilities[+e.target.value]),
                  },
                  state.playerPossibilities.map((possibility, idx) =>
                    option(
                      {
                        value: idx,
                        onclick: (e) => {
                          state.selectedPossibility =
                            state.playerPossibilities[idx];
                        },
                      },
                      idx
                    )
                  )
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
        sorted(state.players, (a, b) => a.residual - b.residual).map(
          (player) => [
            player.residual
              ? li("Residual " + player.color + ": " + player.residual)
              : li(
                  "Valid fields " +
                    player.color +
                    ": " +
                    validFields(player).length
                ),
          ]
        )
      ),
      hr(),
      h1("The table"),
      ul(
        sorted(state.players, (a, b) => a.residual - b.residual).map(
          (player) => [
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
          ]
        )
      )
    ),
});
