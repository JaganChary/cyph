import {Routes} from '@angular/router';
import {AppComponent} from './app.component';


/** @see Routes */
export const appRoutes: Routes	= [
	{path: '', component: AppComponent},
	{path: '404', component: AppComponent},
	{path: 'about', component: AppComponent},
	{path: 'betalist', component: AppComponent},
	{path: 'contact', component: AppComponent},
	{path: 'contact/:email', component: AppComponent},
	{path: 'donate', component: AppComponent},
	{path: 'faq', component: AppComponent},
	{path: 'features', component: AppComponent},
	{path: 'gettingstarted', component: AppComponent},
	{path: 'intro', component: AppComponent},
	{path: 'invite', component: AppComponent},
	{path: 'jjgo', component: AppComponent},
	{path: 'judgejohn', component: AppComponent},
	{path: 'mybrother', component: AppComponent},
	{path: 'penn', component: AppComponent},
	{path: 'privacypolicy', component: AppComponent},
	{path: 'register', component: AppComponent},
	{path: 'sawbones', component: AppComponent},
	{path: 'security', component: AppComponent},
	{path: 'termsofservice', component: AppComponent},
	{path: 'testimonials', component: AppComponent},
	{path: 'ventura', component: AppComponent},
	{path: '**', component: AppComponent}
];
