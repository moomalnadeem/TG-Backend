import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123' })
  @IsNotEmpty({ message: 'Current password is required.' })
  @IsString()
  current_password: string;

  @ApiProperty({ example: 'NewPassword456', minLength: 6 })
  @IsNotEmpty({ message: 'New password is required.' })
  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters.' })
  new_password: string;

  @ApiProperty({ example: 'NewPassword456' })
  @IsNotEmpty({ message: 'Confirm password is required.' })
  @IsString()
  confirm_password: string;
}
