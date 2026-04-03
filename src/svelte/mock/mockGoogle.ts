import * as mockApi from "./mockApi";

function createRunMock() {
  const runMock = {
    successCB: null,
    failureCB: null,

    withFailureHandler(callback) {
      this.failureCB = callback;
      return this;
    },

    withSuccessHandler(callback) {
      this.successCB = callback;
      return this;
    },

    runFunction(f, args) {
      const delay = 1200;
      setTimeout(() => this.doRunFunction(f, args), delay);
    },

    doRunFunction(f, args) {
      try {
        const result = f(...args);
        if (this.successCB) {
          this.successCB(result);
          this.successCB = null;
        }
      } catch (e) {
        if (this.failureCB) {
          this.failureCB(e);
          this.failureCB = null;
        }
      }
    },
  };

  Object.keys(mockApi).forEach((key) => {
    runMock[key] = function (...args) {
      this.runFunction(mockApi[key], args);
    };
  });

  return runMock;
}

const script = {};

Object.defineProperty(script, "run", {
  get() {
    return createRunMock();
  },
});

export default {
  script,
};
