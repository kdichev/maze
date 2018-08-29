import React from "react";
import ReactDOM from "react-dom";
import { createStore, combineReducers, compose, applyMiddleware } from "redux";
import { createActions, handleActions } from "redux-actions";
import { T, F, splitEvery, equals, head, map } from "ramda";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import axios from "axios";
import { connect, Provider } from "react-redux";
import { withProps } from "recompose";

const API_URL = "https://ponychallenge.trustpilot.com/pony-challenge";
// https://github.com/facebook/flow/issues/1192#issuecomment-364301553
if (API_URL == null) throw new Error("NO API ENDPOINT");

const factory = (actionName, initialState) => {
  const ACTION_NAME = actionName.toUpperCase();
  return {
    [`${actionName}`]: handleActions(
      {
        [`${ACTION_NAME}_REQUEST`]: (state, { payload: { data } }) => ({
          ...state,
          loading: T()
        }),
        [`${ACTION_NAME}_SUCCESS`]: (state, { payload: { data } }) => ({
          ...state,
          data,
          loading: F()
        }),
        [`${ACTION_NAME}_FAIL`]: state => ({
          ...state,
          error: T(),
          loading: F()
        })
      },
      {
        loading: F(),
        data: initialState ? { ...initialState } : null,
        error: F()
      }
    ),
    [`${actionName}Actions`]: createActions({
      [`${ACTION_NAME}_REQUEST`]: data => ({ data }),
      [`${ACTION_NAME}_SUCCESS`]: data => ({ data }),
      [`${ACTION_NAME}_FAIL`]: error => ({ error })
    })
  };
};

const { maze, mazeActions } = factory("maze", {
  maze_id: null
});
const { mazeState, mazeStateActions } = factory("mazeState", {
  pony: [70],
  domokun: [218],
  endPoint: [186],
  size: [15, 15],
  difficulty: 0,
  data: []
});

const { nextMove } = factory("nextMove", {
  state: null,
  "state-result": null
});

export const createMaze = ({ width, height }, name) => async dispatch => {
  dispatch(mazeActions.mazeRequest());
  try {
    const {
      data: { maze_id }
    } = await axios({
      url: "/maze",
      baseURL: API_URL,
      method: "POST",
      data: {
        "maze-width": width,
        "maze-height": height,
        "maze-player-name": name,
        difficulty: 0
      }
    });
    return dispatch(mazeActions.mazeSuccess({ maze_id }));
  } catch (error) {
    if (error.response) {
      return dispatch(mazeActions.mazeFail({ error: error.response.data }));
    }
  }
};

export const getMaze = () => async (dispatch, getState) => {
  try {
    const { data } = await axios({
      url: `/maze/${getState().maze.data.maze_id}`,
      baseURL: API_URL,
      method: "GET"
    });
    dispatch(
      mazeStateActions.mazestateSuccess({
        ...data,
        endPoint: data["end-point"]
      })
    );
    return data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    }
  }
};

export const movePony = direction => async (dispatch, getState) => {
  try {
    const { data } = await axios({
      url: `/maze/${getState().game.id}`,
      baseURL: API_URL,
      method: "POST",
      data: {
        direction
      }
    });
    return data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    }
  }
};

export const printMaze = () => async (dispatch, getState) => {
  try {
    const { data } = await axios({
      url: `/maze/${getState().game.id}/print`,
      baseURL: API_URL,
      method: "GET"
    });
    console.log(data);
    return data;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
    }
  }
};

const rootReducer = combineReducers({ maze, mazeState, nextMove });

const store = createStore(
  rootReducer,
  composeWithDevTools(applyMiddleware(thunk))
);

const setPosition = (newItem, newIndex) => (currentItem, currentIndex) =>
  equals(currentIndex, newIndex ? newIndex : currentIndex)
    ? [...currentItem, newItem]
    : [...currentItem];

const mazeGame = (pony, domokun, endPoint, size) =>
  compose(
    // map(map(setPosition("south"))),

    // map(row => {
    //   const test = map(row);
    //   console.log(test(setPosition("east", row.length - 1)));
    //   return test(setPosition("east", row.length - 1));
    // }),
    map(map(setPosition("east"))),
    splitEvery(head(size)),
    map(setPosition("pony", head(pony))),
    map(setPosition("domokun", head(domokun))),
    map(setPosition("endpoint", head(endPoint)))
  );

const appConnector = connect(
  ({
    mazeState: {
      data: { data, pony, domokun, endPoint, size }
    }
  }) => ({
    apiData: data,
    pony,
    domokun,
    endPoint,
    size
  }),
  dispatch => ({
    createMaze: () => dispatch(createMaze({ width: 15, height: 15 }, "rarity")),
    getMaze: () => dispatch(getMaze())
  })
);

const AppControls = ({ create, get }) => (
  <React.Fragment>
    <button onClick={create}>Create Maze</button>
    <button onClick={get}>Get Maze</button>
  </React.Fragment>
);

const MazeRow = ({ row }) =>
  row.map(box => {
    return (
      <div
        style={{
          boxSizing: "border-box",
          width: 20,
          height: 20,
          backgroundColor:
            (box.includes("pony") && "pink") ||
            (box.includes("domokun") && "red") ||
            (box.includes("endpoint") && "lightgreen") ||
            "lightgray",

          borderTop: box.includes("north") && "1px solid black",
          borderLeft: box.includes("west") && "1px solid black",
          borderRight: box.includes("east") && "1px solid black"
          // borderBottom: box.includes("south") && "1px solid black"
        }}
      >
        {box.includes("pony") && "P"}
        {box.includes("domokun") && "D"}
        {box.includes("endpoint") && "E"}
      </div>
    );
  });

const Maze = ({ mazeRows }) => {
  return mazeRows.map(row => (
    <div style={{ display: "flex" }}>
      <MazeRow row={row} />
    </div>
  ));
};

const App = appConnector(({ createMaze, getMaze, mazeData }) => {
  return (
    <React.Fragment>
      <AppControls create={createMaze} get={getMaze} />
      <Maze mazeRows={mazeData} />
    </React.Fragment>
  );
});

const Game = compose(
  appConnector,
  withProps(({ apiData, pony, domokun, endPoint, size }) => ({
    mazeData: mazeGame(pony, domokun, endPoint, size)(apiData)
  }))
)(App);

const rootElement = document.getElementById("root");

ReactDOM.render(
  <Provider store={store}>
    <Game />
  </Provider>,
  rootElement
);
