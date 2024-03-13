class CustomError extends Error {
  statusCode: number;
  error: any;

  constructor(statusCode: number, error: any) {
    super();
    this.statusCode = statusCode;
    this.error = error;
  }
}

export default CustomError;
