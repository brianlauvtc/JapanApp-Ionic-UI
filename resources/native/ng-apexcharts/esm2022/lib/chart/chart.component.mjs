import { isPlatformBrowser } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, NgZone, output, PLATFORM_ID, signal, viewChild, } from "@angular/core";
import { asapScheduler } from "rxjs";
import * as i0 from "@angular/core";
export class ChartComponent {
    constructor() {
        this.chart = input();
        this.annotations = input();
        this.colors = input();
        this.dataLabels = input();
        this.series = input();
        this.stroke = input();
        this.labels = input();
        this.legend = input();
        this.markers = input();
        this.noData = input();
        this.fill = input();
        this.tooltip = input();
        this.plotOptions = input();
        this.responsive = input();
        this.xaxis = input();
        this.yaxis = input();
        this.forecastDataPoints = input();
        this.grid = input();
        this.states = input();
        this.title = input();
        this.subtitle = input();
        this.theme = input();
        this.autoUpdateSeries = input(true);
        this.chartReady = output();
        // If consumers need to capture the `chartInstance` for use, consumers
        // can access the component instance through `viewChild` and use `computed`
        // or `effect` on `component.chartInstance()` to monitor its changes and
        // recompute effects or computations whenever `chartInstance` is updated.
        this.chartInstance = signal(null);
        this.chartElement = viewChild.required("chart");
        this.ngZone = inject(NgZone);
        this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    }
    ngOnChanges(changes) {
        if (!this.isBrowser)
            return;
        this.ngZone.runOutsideAngular(() => {
            asapScheduler.schedule(() => this.hydrate(changes));
        });
    }
    ngOnDestroy() {
        this.destroy();
    }
    hydrate(changes) {
        const shouldUpdateSeries = this.autoUpdateSeries() &&
            Object.keys(changes).filter((c) => c !== "series").length === 0;
        if (shouldUpdateSeries) {
            this.updateSeries(this.series(), true);
            return;
        }
        this.createElement();
    }
    async createElement() {
        const { default: ApexCharts } = await import("apexcharts");
        window.ApexCharts ||= ApexCharts;
        const options = {};
        const properties = [
            "annotations",
            "chart",
            "colors",
            "dataLabels",
            "series",
            "stroke",
            "labels",
            "legend",
            "fill",
            "tooltip",
            "plotOptions",
            "responsive",
            "markers",
            "noData",
            "xaxis",
            "yaxis",
            "forecastDataPoints",
            "grid",
            "states",
            "title",
            "subtitle",
            "theme",
        ];
        properties.forEach((property) => {
            const value = this[property]();
            if (value) {
                options[property] = value;
            }
        });
        this.destroy();
        const chartInstance = this.ngZone.runOutsideAngular(() => new ApexCharts(this.chartElement().nativeElement, options));
        this.chartInstance.set(chartInstance);
        this.render();
        this.chartReady.emit({ chartObj: chartInstance });
    }
    render() {
        return this.ngZone.runOutsideAngular(() => this.chartInstance()?.render());
    }
    updateOptions(options, redrawPaths, animate, updateSyncedCharts) {
        return this.ngZone.runOutsideAngular(() => this.chartInstance()?.updateOptions(options, redrawPaths, animate, updateSyncedCharts));
    }
    updateSeries(newSeries, animate) {
        return this.ngZone.runOutsideAngular(() => this.chartInstance()?.updateSeries(newSeries, animate));
    }
    appendSeries(newSeries, animate) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.appendSeries(newSeries, animate));
    }
    appendData(newData) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.appendData(newData));
    }
    highlightSeries(seriesName) {
        return this.ngZone.runOutsideAngular(() => this.chartInstance()?.highlightSeries(seriesName));
    }
    toggleSeries(seriesName) {
        return this.ngZone.runOutsideAngular(() => this.chartInstance()?.toggleSeries(seriesName));
    }
    showSeries(seriesName) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.showSeries(seriesName));
    }
    hideSeries(seriesName) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.hideSeries(seriesName));
    }
    resetSeries() {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.resetSeries());
    }
    zoomX(min, max) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.zoomX(min, max));
    }
    toggleDataPointSelection(seriesIndex, dataPointIndex) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.toggleDataPointSelection(seriesIndex, dataPointIndex));
    }
    destroy() {
        this.chartInstance()?.destroy();
        this.chartInstance.set(null);
    }
    setLocale(localeName) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.setLocale(localeName));
    }
    paper() {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.paper());
    }
    addXaxisAnnotation(options, pushToMemory, context) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.addXaxisAnnotation(options, pushToMemory, context));
    }
    addYaxisAnnotation(options, pushToMemory, context) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.addYaxisAnnotation(options, pushToMemory, context));
    }
    addPointAnnotation(options, pushToMemory, context) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.addPointAnnotation(options, pushToMemory, context));
    }
    removeAnnotation(id, options) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.removeAnnotation(id, options));
    }
    clearAnnotations(options) {
        this.ngZone.runOutsideAngular(() => this.chartInstance()?.clearAnnotations(options));
    }
    dataURI(options) {
        return this.chartInstance()?.dataURI(options);
    }
    /** @nocollapse */ static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "18.1.3", ngImport: i0, type: ChartComponent, deps: [], target: i0.ɵɵFactoryTarget.Component }); }
    /** @nocollapse */ static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.2.0", version: "18.1.3", type: ChartComponent, isStandalone: true, selector: "apx-chart", inputs: { chart: { classPropertyName: "chart", publicName: "chart", isSignal: true, isRequired: false, transformFunction: null }, annotations: { classPropertyName: "annotations", publicName: "annotations", isSignal: true, isRequired: false, transformFunction: null }, colors: { classPropertyName: "colors", publicName: "colors", isSignal: true, isRequired: false, transformFunction: null }, dataLabels: { classPropertyName: "dataLabels", publicName: "dataLabels", isSignal: true, isRequired: false, transformFunction: null }, series: { classPropertyName: "series", publicName: "series", isSignal: true, isRequired: false, transformFunction: null }, stroke: { classPropertyName: "stroke", publicName: "stroke", isSignal: true, isRequired: false, transformFunction: null }, labels: { classPropertyName: "labels", publicName: "labels", isSignal: true, isRequired: false, transformFunction: null }, legend: { classPropertyName: "legend", publicName: "legend", isSignal: true, isRequired: false, transformFunction: null }, markers: { classPropertyName: "markers", publicName: "markers", isSignal: true, isRequired: false, transformFunction: null }, noData: { classPropertyName: "noData", publicName: "noData", isSignal: true, isRequired: false, transformFunction: null }, fill: { classPropertyName: "fill", publicName: "fill", isSignal: true, isRequired: false, transformFunction: null }, tooltip: { classPropertyName: "tooltip", publicName: "tooltip", isSignal: true, isRequired: false, transformFunction: null }, plotOptions: { classPropertyName: "plotOptions", publicName: "plotOptions", isSignal: true, isRequired: false, transformFunction: null }, responsive: { classPropertyName: "responsive", publicName: "responsive", isSignal: true, isRequired: false, transformFunction: null }, xaxis: { classPropertyName: "xaxis", publicName: "xaxis", isSignal: true, isRequired: false, transformFunction: null }, yaxis: { classPropertyName: "yaxis", publicName: "yaxis", isSignal: true, isRequired: false, transformFunction: null }, forecastDataPoints: { classPropertyName: "forecastDataPoints", publicName: "forecastDataPoints", isSignal: true, isRequired: false, transformFunction: null }, grid: { classPropertyName: "grid", publicName: "grid", isSignal: true, isRequired: false, transformFunction: null }, states: { classPropertyName: "states", publicName: "states", isSignal: true, isRequired: false, transformFunction: null }, title: { classPropertyName: "title", publicName: "title", isSignal: true, isRequired: false, transformFunction: null }, subtitle: { classPropertyName: "subtitle", publicName: "subtitle", isSignal: true, isRequired: false, transformFunction: null }, theme: { classPropertyName: "theme", publicName: "theme", isSignal: true, isRequired: false, transformFunction: null }, autoUpdateSeries: { classPropertyName: "autoUpdateSeries", publicName: "autoUpdateSeries", isSignal: true, isRequired: false, transformFunction: null } }, outputs: { chartReady: "chartReady" }, viewQueries: [{ propertyName: "chartElement", first: true, predicate: ["chart"], descendants: true, isSignal: true }], usesOnChanges: true, ngImport: i0, template: `<div #chart></div>`, isInline: true, changeDetection: i0.ChangeDetectionStrategy.OnPush }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "18.1.3", ngImport: i0, type: ChartComponent, decorators: [{
            type: Component,
            args: [{
                    selector: "apx-chart",
                    template: `<div #chart></div>`,
                    changeDetection: ChangeDetectionStrategy.OnPush,
                    standalone: true,
                }]
        }] });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhcnQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vcHJvamVjdHMvbmctYXBleGNoYXJ0cy9zcmMvbGliL2NoYXJ0L2NoYXJ0LmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNwRCxPQUFPLEVBQ0wsdUJBQXVCLEVBQ3ZCLFNBQVMsRUFFVCxNQUFNLEVBQ04sS0FBSyxFQUNMLE1BQU0sRUFHTixNQUFNLEVBQ04sV0FBVyxFQUNYLE1BQU0sRUFFTixTQUFTLEdBQ1YsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLE1BQU0sQ0FBQzs7QUFzQ3JDLE1BQU0sT0FBTyxjQUFjO0lBTjNCO1FBT1csVUFBSyxHQUFHLEtBQUssRUFBYSxDQUFDO1FBQzNCLGdCQUFXLEdBQUcsS0FBSyxFQUFtQixDQUFDO1FBQ3ZDLFdBQU0sR0FBRyxLQUFLLEVBQVMsQ0FBQztRQUN4QixlQUFVLEdBQUcsS0FBSyxFQUFrQixDQUFDO1FBQ3JDLFdBQU0sR0FBRyxLQUFLLEVBQWdELENBQUM7UUFDL0QsV0FBTSxHQUFHLEtBQUssRUFBYyxDQUFDO1FBQzdCLFdBQU0sR0FBRyxLQUFLLEVBQVksQ0FBQztRQUMzQixXQUFNLEdBQUcsS0FBSyxFQUFjLENBQUM7UUFDN0IsWUFBTyxHQUFHLEtBQUssRUFBZSxDQUFDO1FBQy9CLFdBQU0sR0FBRyxLQUFLLEVBQWMsQ0FBQztRQUM3QixTQUFJLEdBQUcsS0FBSyxFQUFZLENBQUM7UUFDekIsWUFBTyxHQUFHLEtBQUssRUFBZSxDQUFDO1FBQy9CLGdCQUFXLEdBQUcsS0FBSyxFQUFtQixDQUFDO1FBQ3ZDLGVBQVUsR0FBRyxLQUFLLEVBQW9CLENBQUM7UUFDdkMsVUFBSyxHQUFHLEtBQUssRUFBYSxDQUFDO1FBQzNCLFVBQUssR0FBRyxLQUFLLEVBQTJC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QyxVQUFVLEVBQUUsSUFBSTtpQkFDakIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc1BsYXRmb3JtQnJvd3NlciB9IGZyb20gXCJAYW5ndWxhci9jb21tb25cIjtcbmltcG9ydCB7XG4gIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LFxuICBDb21wb25lbnQsXG4gIEVsZW1lbnRSZWYsXG4gIGluamVjdCxcbiAgaW5wdXQsXG4gIE5nWm9uZSxcbiAgT25DaGFuZ2VzLFxuICBPbkRlc3Ryb3ksXG4gIG91dHB1dCxcbiAgUExBVEZPUk1fSUQsXG4gIHNpZ25hbCxcbiAgU2ltcGxlQ2hhbmdlcyxcbiAgdmlld0NoaWxkLFxufSBmcm9tIFwiQGFuZ3VsYXIvY29yZVwiO1xuaW1wb3J0IHsgYXNhcFNjaGVkdWxlciB9IGZyb20gXCJyeGpzXCI7XG5pbXBvcnQge1xuICBBcGV4QW5ub3RhdGlvbnMsXG4gIEFwZXhBeGlzQ2hhcnRTZXJpZXMsXG4gIEFwZXhDaGFydCxcbiAgQXBleERhdGFMYWJlbHMsXG4gIEFwZXhGaWxsLFxuICBBcGV4Rm9yZWNhc3REYXRhUG9pbnRzLFxuICBBcGV4R3JpZCxcbiAgQXBleExlZ2VuZCxcbiAgQXBleE1hcmtlcnMsXG4gIEFwZXhOb0RhdGEsXG4gIEFwZXhOb25BeGlzQ2hhcnRTZXJpZXMsXG4gIEFwZXhQbG90T3B0aW9ucyxcbiAgQXBleFJlc3BvbnNpdmUsXG4gIEFwZXhTdGF0ZXMsXG4gIEFwZXhTdHJva2UsXG4gIEFwZXhUaGVtZSxcbiAgQXBleFRpdGxlU3VidGl0bGUsXG4gIEFwZXhUb29sdGlwLFxuICBBcGV4WEF4aXMsXG4gIEFwZXhZQXhpcyxcbn0gZnJvbSBcIi4uL21vZGVsL2FwZXgtdHlwZXNcIjtcblxudHlwZSBBcGV4Q2hhcnRzID0gaW1wb3J0KFwiYXBleGNoYXJ0c1wiKTtcblxuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgV2luZG93IHtcbiAgICBBcGV4Q2hhcnRzOiB0eXBlb2YgQXBleENoYXJ0cztcbiAgfVxufVxuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6IFwiYXB4LWNoYXJ0XCIsXG4gIHRlbXBsYXRlOiBgPGRpdiAjY2hhcnQ+PC9kaXY+YCxcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5PblB1c2gsXG4gIHN0YW5kYWxvbmU6IHRydWUsXG59KVxuZXhwb3J0IGNsYXNzIENoYXJ0Q29tcG9uZW50IGltcGxlbWVudHMgT25DaGFuZ2VzLCBPbkRlc3Ryb3kge1xuICByZWFkb25seSBjaGFydCA9IGlucHV0PEFwZXhDaGFydD4oKTtcbiAgcmVhZG9ubHkgYW5ub3RhdGlvbnMgPSBpbnB1dDxBcGV4QW5ub3RhdGlvbnM+KCk7XG4gIHJlYWRvbmx5IGNvbG9ycyA9IGlucHV0PGFueVtdPigpO1xuICByZWFkb25seSBkYXRhTGFiZWxzID0gaW5wdXQ8QXBleERhdGFMYWJlbHM+KCk7XG4gIHJlYWRvbmx5IHNlcmllcyA9IGlucHV0PEFwZXhBeGlzQ2hhcnRTZXJpZXMgfCBBcGV4Tm9uQXhpc0NoYXJ0U2VyaWVzPigpO1xuICByZWFkb25seSBzdHJva2UgPSBpbnB1dDxBcGV4U3Ryb2tlPigpO1xuICByZWFkb25seSBsYWJlbHMgPSBpbnB1dDxzdHJpbmdbXT4oKTtcbiAgcmVhZG9ubHkgbGVnZW5kID0gaW5wdXQ8QXBleExlZ2VuZD4oKTtcbiAgcmVhZG9ubHkgbWFya2VycyA9IGlucHV0PEFwZXhNYXJrZXJzPigpO1xuICByZWFkb25seSBub0RhdGEgPSBpbnB1dDxBcGV4Tm9EYXRhPigpO1xuICByZWFkb25seSBmaWxsID0gaW5wdXQ8QXBleEZpbGw+KCk7XG4gIHJlYWRvbmx5IHRvb2x0aXAgPSBpbnB1dDxBcGV4VG9vbHRpcD4oKTtcbiAgcmVhZG9ubHkgcGxvdE9wdGlvbnMgPSBpbnB1dDxBcGV4UGxvdE9wdGlvbnM+KCk7XG4gIHJlYWRvbmx5IHJlc3BvbnNpdmUgPSBpbnB1dDxBcGV4UmVzcG9uc2l2ZVtdPigpO1xuICByZWFkb25seSB4YXhpcyA9IGlucHV0PEFwZXhYQXhpcz4oKTtcbiAgcmVhZG9ubHkgeWF4aXMgPSBpbnB1dDxBcGV4WUF4aXMgfCBBcGV4WUF4aXNbXT4oKTtcbiAgcmVhZG9ubHkgZm9yZWNhc3REYXRhUG9pbnRzID0gaW5wdXQ8QXBleEZvcmVjYXN0RGF0YVBvaW50cz4oKTtcbiAgcmVhZG9ubHkgZ3JpZCA9IGlucHV0PEFwZXhHcmlkPigpO1xuICByZWFkb25seSBzdGF0ZXMgPSBpbnB1dDxBcGV4U3RhdGVzPigpO1xuICByZWFkb25seSB0aXRsZSA9IGlucHV0PEFwZXhUaXRsZVN1YnRpdGxlPigpO1xuICByZWFkb25seSBzdWJ0aXRsZSA9IGlucHV0PEFwZXhUaXRsZVN1YnRpdGxlPigpO1xuICByZWFkb25seSB0aGVtZSA9IGlucHV0PEFwZXhUaGVtZT4oKTtcblxuICByZWFkb25seSBhdXRvVXBkYXRlU2VyaWVzID0gaW5wdXQodHJ1ZSk7XG5cbiAgcmVhZG9ubHkgY2hhcnRSZWFkeSA9IG91dHB1dDx7IGNoYXJ0T2JqOiBBcGV4Q2hhcnRzIH0+KCk7XG5cbiAgLy8gSWYgY29uc3VtZXJzIG5lZWQgdG8gY2FwdHVyZSB0aGUgYGNoYXJ0SW5zdGFuY2VgIGZvciB1c2UsIGNvbnN1bWVyc1xuICAvLyBjYW4gYWNjZXNzIHRoZSBjb21wb25lbnQgaW5zdGFuY2UgdGhyb3VnaCBgdmlld0NoaWxkYCBhbmQgdXNlIGBjb21wdXRlZGBcbiAgLy8gb3IgYGVmZmVjdGAgb24gYGNvbXBvbmVudC5jaGFydEluc3RhbmNlKClgIHRvIG1vbml0b3IgaXRzIGNoYW5nZXMgYW5kXG4gIC8vIHJlY29tcHV0ZSBlZmZlY3RzIG9yIGNvbXB1dGF0aW9ucyB3aGVuZXZlciBgY2hhcnRJbnN0YW5jZWAgaXMgdXBkYXRlZC5cbiAgcmVhZG9ubHkgY2hhcnRJbnN0YW5jZSA9IHNpZ25hbDxBcGV4Q2hhcnRzIHwgbnVsbD4obnVsbCk7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBjaGFydEVsZW1lbnQgPVxuICAgIHZpZXdDaGlsZC5yZXF1aXJlZDxFbGVtZW50UmVmPEhUTUxFbGVtZW50Pj4oXCJjaGFydFwiKTtcblxuICBwcml2YXRlIG5nWm9uZSA9IGluamVjdChOZ1pvbmUpO1xuICBwcml2YXRlIGlzQnJvd3NlciA9IGlzUGxhdGZvcm1Ccm93c2VyKGluamVjdChQTEFURk9STV9JRCkpO1xuXG4gIG5nT25DaGFuZ2VzKGNoYW5nZXM6IFNpbXBsZUNoYW5nZXMpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaXNCcm93c2VyKSByZXR1cm47XG5cbiAgICB0aGlzLm5nWm9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PiB7XG4gICAgICBhc2FwU2NoZWR1bGVyLnNjaGVkdWxlKCgpID0+IHRoaXMuaHlkcmF0ZShjaGFuZ2VzKSk7XG4gICAgfSk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpIHtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHByaXZhdGUgaHlkcmF0ZShjaGFuZ2VzOiBTaW1wbGVDaGFuZ2VzKTogdm9pZCB7XG4gICAgY29uc3Qgc2hvdWxkVXBkYXRlU2VyaWVzID1cbiAgICAgIHRoaXMuYXV0b1VwZGF0ZVNlcmllcygpICYmXG4gICAgICBPYmplY3Qua2V5cyhjaGFuZ2VzKS5maWx0ZXIoKGMpID0+IGMgIT09IFwic2VyaWVzXCIpLmxlbmd0aCA9PT0gMDtcblxuICAgIGlmIChzaG91bGRVcGRhdGVTZXJpZXMpIHtcbiAgICAgIHRoaXMudXBkYXRlU2VyaWVzKHRoaXMuc2VyaWVzKCksIHRydWUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3JlYXRlRWxlbWVudCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjcmVhdGVFbGVtZW50KCkge1xuICAgIGNvbnN0IHsgZGVmYXVsdDogQXBleENoYXJ0cyB9ID0gYXdhaXQgaW1wb3J0KFwiYXBleGNoYXJ0c1wiKTtcbiAgICB3aW5kb3cuQXBleENoYXJ0cyB8fD0gQXBleENoYXJ0cztcblxuICAgIGNvbnN0IG9wdGlvbnM6IGFueSA9IHt9O1xuXG4gICAgY29uc3QgcHJvcGVydGllcyA9IFtcbiAgICAgIFwiYW5ub3RhdGlvbnNcIixcbiAgICAgIFwiY2hhcnRcIixcbiAgICAgIFwiY29sb3JzXCIsXG4gICAgICBcImRhdGFMYWJlbHNcIixcbiAgICAgIFwic2VyaWVzXCIsXG4gICAgICBcInN0cm9rZVwiLFxuICAgICAgXCJsYWJlbHNcIixcbiAgICAgIFwibGVnZW5kXCIsXG4gICAgICBcImZpbGxcIixcbiAgICAgIFwidG9vbHRpcFwiLFxuICAgICAgXCJwbG90T3B0aW9uc1wiLFxuICAgICAgXCJyZXNwb25zaXZlXCIsXG4gICAgICBcIm1hcmtlcnNcIixcbiAgICAgIFwibm9EYXRhXCIsXG4gICAgICBcInhheGlzXCIsXG4gICAgICBcInlheGlzXCIsXG4gICAgICBcImZvcmVjYXN0RGF0YVBvaW50c1wiLFxuICAgICAgXCJncmlkXCIsXG4gICAgICBcInN0YXRlc1wiLFxuICAgICAgXCJ0aXRsZVwiLFxuICAgICAgXCJzdWJ0aXRsZVwiLFxuICAgICAgXCJ0aGVtZVwiLFxuICAgIF0gYXMgY29uc3Q7XG5cbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHRoaXNbcHJvcGVydHldKCk7XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgb3B0aW9uc1twcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuZGVzdHJveSgpO1xuXG4gICAgY29uc3QgY2hhcnRJbnN0YW5jZSA9IHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKFxuICAgICAgKCkgPT4gbmV3IEFwZXhDaGFydHModGhpcy5jaGFydEVsZW1lbnQoKS5uYXRpdmVFbGVtZW50LCBvcHRpb25zKVxuICAgICk7XG5cbiAgICB0aGlzLmNoYXJ0SW5zdGFuY2Uuc2V0KGNoYXJ0SW5zdGFuY2UpO1xuXG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgICB0aGlzLmNoYXJ0UmVhZHkuZW1pdCh7IGNoYXJ0T2JqOiBjaGFydEluc3RhbmNlIH0pO1xuICB9XG5cbiAgcHVibGljIHJlbmRlcigpIHtcbiAgICByZXR1cm4gdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT4gdGhpcy5jaGFydEluc3RhbmNlKCk/LnJlbmRlcigpKTtcbiAgfVxuXG4gIHB1YmxpYyB1cGRhdGVPcHRpb25zKFxuICAgIG9wdGlvbnM6IGFueSxcbiAgICByZWRyYXdQYXRocz86IGJvb2xlYW4sXG4gICAgYW5pbWF0ZT86IGJvb2xlYW4sXG4gICAgdXBkYXRlU3luY2VkQ2hhcnRzPzogYm9vbGVhblxuICApIHtcbiAgICByZXR1cm4gdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT5cbiAgICAgIHRoaXMuY2hhcnRJbnN0YW5jZSgpPy51cGRhdGVPcHRpb25zKFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICByZWRyYXdQYXRocyxcbiAgICAgICAgYW5pbWF0ZSxcbiAgICAgICAgdXBkYXRlU3luY2VkQ2hhcnRzXG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIHB1YmxpYyB1cGRhdGVTZXJpZXMoXG4gICAgbmV3U2VyaWVzOiBBcGV4QXhpc0NoYXJ0U2VyaWVzIHwgQXBleE5vbkF4aXNDaGFydFNlcmllcyxcbiAgICBhbmltYXRlPzogYm9vbGVhblxuICApIHtcbiAgICByZXR1cm4gdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT5cbiAgICAgIHRoaXMuY2hhcnRJbnN0YW5jZSgpPy51cGRhdGVTZXJpZXMobmV3U2VyaWVzLCBhbmltYXRlKVxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgYXBwZW5kU2VyaWVzKFxuICAgIG5ld1NlcmllczogQXBleEF4aXNDaGFydFNlcmllcyB8IEFwZXhOb25BeGlzQ2hhcnRTZXJpZXMsXG4gICAgYW5pbWF0ZT86IGJvb2xlYW5cbiAgKSB7XG4gICAgdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT5cbiAgICAgIHRoaXMuY2hhcnRJbnN0YW5jZSgpPy5hcHBlbmRTZXJpZXMobmV3U2VyaWVzLCBhbmltYXRlKVxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgYXBwZW5kRGF0YShuZXdEYXRhOiBhbnlbXSkge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8uYXBwZW5kRGF0YShuZXdEYXRhKVxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgaGlnaGxpZ2h0U2VyaWVzKHNlcmllc05hbWU6IHN0cmluZyk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8uaGlnaGxpZ2h0U2VyaWVzKHNlcmllc05hbWUpXG4gICAgKTtcbiAgfVxuXG4gIHB1YmxpYyB0b2dnbGVTZXJpZXMoc2VyaWVzTmFtZTogc3RyaW5nKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT5cbiAgICAgIHRoaXMuY2hhcnRJbnN0YW5jZSgpPy50b2dnbGVTZXJpZXMoc2VyaWVzTmFtZSlcbiAgICApO1xuICB9XG5cbiAgcHVibGljIHNob3dTZXJpZXMoc2VyaWVzTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT5cbiAgICAgIHRoaXMuY2hhcnRJbnN0YW5jZSgpPy5zaG93U2VyaWVzKHNlcmllc05hbWUpXG4gICAgKTtcbiAgfVxuXG4gIHB1YmxpYyBoaWRlU2VyaWVzKHNlcmllc05hbWU6IHN0cmluZykge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8uaGlkZVNlcmllcyhzZXJpZXNOYW1lKVxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgcmVzZXRTZXJpZXMoKSB7XG4gICAgdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT4gdGhpcy5jaGFydEluc3RhbmNlKCk/LnJlc2V0U2VyaWVzKCkpO1xuICB9XG5cbiAgcHVibGljIHpvb21YKG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+IHRoaXMuY2hhcnRJbnN0YW5jZSgpPy56b29tWChtaW4sIG1heCkpO1xuICB9XG5cbiAgcHVibGljIHRvZ2dsZURhdGFQb2ludFNlbGVjdGlvbihcbiAgICBzZXJpZXNJbmRleDogbnVtYmVyLFxuICAgIGRhdGFQb2ludEluZGV4PzogbnVtYmVyXG4gICkge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8udG9nZ2xlRGF0YVBvaW50U2VsZWN0aW9uKFxuICAgICAgICBzZXJpZXNJbmRleCxcbiAgICAgICAgZGF0YVBvaW50SW5kZXhcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jaGFydEluc3RhbmNlKCk/LmRlc3Ryb3koKTtcbiAgICB0aGlzLmNoYXJ0SW5zdGFuY2Uuc2V0KG51bGwpO1xuICB9XG5cbiAgcHVibGljIHNldExvY2FsZShsb2NhbGVOYW1lOiBzdHJpbmcpIHtcbiAgICB0aGlzLm5nWm9uZS5ydW5PdXRzaWRlQW5ndWxhcigoKSA9PlxuICAgICAgdGhpcy5jaGFydEluc3RhbmNlKCk/LnNldExvY2FsZShsb2NhbGVOYW1lKVxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgcGFwZXIoKSB7XG4gICAgdGhpcy5uZ1pvbmUucnVuT3V0c2lkZUFuZ3VsYXIoKCkgPT4gdGhpcy5jaGFydEluc3RhbmNlKCk/LnBhcGVyKCkpO1xuICB9XG5cbiAgcHVibGljIGFkZFhheGlzQW5ub3RhdGlvbihcbiAgICBvcHRpb25zOiBhbnksXG4gICAgcHVzaFRvTWVtb3J5PzogYm9vbGVhbixcbiAgICBjb250ZXh0PzogYW55XG4gICkge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8uYWRkWGF4aXNBbm5vdGF0aW9uKG9wdGlvbnMsIHB1c2hUb01lbW9yeSwgY29udGV4dClcbiAgICApO1xuICB9XG5cbiAgcHVibGljIGFkZFlheGlzQW5ub3RhdGlvbihcbiAgICBvcHRpb25zOiBhbnksXG4gICAgcHVzaFRvTWVtb3J5PzogYm9vbGVhbixcbiAgICBjb250ZXh0PzogYW55XG4gICkge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8uYWRkWWF4aXNBbm5vdGF0aW9uKG9wdGlvbnMsIHB1c2hUb01lbW9yeSwgY29udGV4dClcbiAgICApO1xuICB9XG5cbiAgcHVibGljIGFkZFBvaW50QW5ub3RhdGlvbihcbiAgICBvcHRpb25zOiBhbnksXG4gICAgcHVzaFRvTWVtb3J5PzogYm9vbGVhbixcbiAgICBjb250ZXh0PzogYW55XG4gICkge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8uYWRkUG9pbnRBbm5vdGF0aW9uKG9wdGlvbnMsIHB1c2hUb01lbW9yeSwgY29udGV4dClcbiAgICApO1xuICB9XG5cbiAgcHVibGljIHJlbW92ZUFubm90YXRpb24oaWQ6IHN0cmluZywgb3B0aW9ucz86IGFueSkge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8ucmVtb3ZlQW5ub3RhdGlvbihpZCwgb3B0aW9ucylcbiAgICApO1xuICB9XG5cbiAgcHVibGljIGNsZWFyQW5ub3RhdGlvbnMob3B0aW9ucz86IGFueSkge1xuICAgIHRoaXMubmdab25lLnJ1bk91dHNpZGVBbmd1bGFyKCgpID0+XG4gICAgICB0aGlzLmNoYXJ0SW5zdGFuY2UoKT8uY2xlYXJBbm5vdGF0aW9ucyhvcHRpb25zKVxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgZGF0YVVSSShvcHRpb25zPzogYW55KSB7XG4gICAgcmV0dXJuIHRoaXMuY2hhcnRJbnN0YW5jZSgpPy5kYXRhVVJJKG9wdGlvbnMpO1xuICB9XG59XG4iXX0=