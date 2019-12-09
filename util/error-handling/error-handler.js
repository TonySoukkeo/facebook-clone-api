module.exports = {
  error: (err, next) => {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  },
  errorHandler: (status, message, type = "") => {
    const error = new Error(message);
    error.type = type;
    error.statusCode = status;

    throw error;
  },
  validationError: (err, type = "") => {
    if (!err.isEmpty()) {
      const message = err.array()[0].msg;

      const error = new Error(message);
      error.type = type;
      error.statusCode = 422;

      throw error;
    }
  }
};
