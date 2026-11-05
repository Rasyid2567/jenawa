
import * as service from './auth.service.js';

export async function register(req, res, next) {
  try {
    const user = await service.register(req.validatedBody);

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil.',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const data = await service.login(req.validatedBody);

    res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await service.getCurrentUser(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    await service.logout(req.user);

    res.json({
      success: true,
      message: 'Logout berhasil. Token telah dicabut.'
    });
  } catch (error) {
    next(error);
  }
}
