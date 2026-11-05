
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan.'
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    console.error('Kesalahan internal server.');
  }

  res.status(status).json({
    success: false,
    message: status >= 500
      ? 'Terjadi kesalahan pada server.'
      : err.message
  });
}
