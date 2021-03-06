import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {UserResolverService} from './shared/services/user-resolver.service';

// Import Containers
import {DefaultLayoutComponent} from "./containers";

export const routes: Routes = [
  {
    path: '',
    component: DefaultLayoutComponent,
    loadChildren: './home/home.module#HomeModule',
    resolve: {
      user: UserResolverService
    }
  },
  {
    path: 'login',
    loadChildren: './login/login.module#LoginModule'
  },
  {
    path: 'signup',
    loadChildren: './signup/signup.module#SignupModule'
  },
  {
    path: 'invite-user',
    loadChildren: './invite-user/invite-user.module#InviteUserModule'
  },
  {
    path: 'forgot-password',
    loadChildren: './forgot-password/forgot-password.module#ForgotPasswordModule'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
