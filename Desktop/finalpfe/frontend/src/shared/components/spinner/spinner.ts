import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './spinner.html'
})
export class Spinner {}
