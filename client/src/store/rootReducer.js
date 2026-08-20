import { combineReducers } from "redux";
import { authReducer } from "./authSlice.js";
import { instructionsReducer } from "./instructionsSlice.js";

export const rootReducer = combineReducers({
  auth: authReducer,
  instructions: instructionsReducer,
});