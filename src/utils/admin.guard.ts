import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Example: API key–based admin auth
    const adminKey = request.headers['x-admin-key'];

    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      throw new UnauthorizedException('Admin access only');
    }

    return true;
  }
}
