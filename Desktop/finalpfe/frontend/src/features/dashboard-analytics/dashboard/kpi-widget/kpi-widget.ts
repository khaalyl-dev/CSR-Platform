import { Component, input } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-kpi-widget',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FontAwesomeModule],
  template: `
    <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-gray-500">{{ label() }}</p>
          <p class="mt-2 text-2xl font-bold text-gray-800">
            @if (format() === 'number') {
              {{ value() | number:'1.0-0' }}
            } @else if (format() === 'currency') {
              {{ value() | number:'1.2-2':'fr-FR' }} €
            } @else if (format() === 'percent') {
              {{ value() | number:'1.1-1':'fr-FR' }}%
            } @else {
              {{ value() }}
            }
          </p>
          @if (trend()) {
            <span
              class="mt-1 inline-flex text-xs font-medium"
              [class.text-emerald-600]="trend() === 'up'"
              [class.text-amber-600]="trend() === 'down'"
              [class.text-gray-500]="trend() === 'neutral'">
              {{ trendLabel() }}
            </span>
          }
        </div>
        @if (icon()) {
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl"
            [ngClass]="iconBgClass()">
            <fa-icon [icon]="icon()!" class="h-6 w-6 text-gray-600"></fa-icon>
          </div>
        }
      </div>
    </div>
  `
})
export class KpiWidgetComponent {
  label = input.required<string>();
  value = input<number | string>(0);
  format = input<'number' | 'currency' | 'percent' | 'text'>('number');
  trend = input<'up' | 'down' | 'neutral' | null>(null);
  trendLabel = input<string>('');
  icon = input<any>(null);
  iconBgClass = input<string>('bg-gray-100');
}
