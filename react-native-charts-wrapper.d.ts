declare module 'react-native-charts-wrapper' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  export interface BarChartData {
    dataSets: Array<{
      label: string;
      values: Array<{ x: number; y: number }>;
      config?: {
        color?: string;
        barShadowColor?: string;
        highlightAlpha?: number;
        highlightColor?: string;
      };
    }>;
    config?: {
      barWidth?: number;
      group?: {
        fromX: number;
        groupSpace: number;
        barSpace: number;
      };
    };
  }

  export interface AxisConfig {
    valueFormatter?: string | string[];
    granularity?: number;
    granularityEnabled?: boolean;
    position?: 'TOP' | 'BOTTOM' | 'BOTH_SIDED' | 'TOP_INSIDE' | 'BOTTOM_INSIDE';
    textSize?: number;
    textColor?: string;
    axisLineColor?: string;
    gridColor?: string;
    avoidFirstLastClipping?: boolean;
    axisMinimum?: number;
    axisMaximum?: number;
    enabled?: boolean;
  }

  export interface YAxisConfig {
    left?: AxisConfig;
    right?: AxisConfig;
  }

  export interface LegendConfig {
    enabled?: boolean;
    textSize?: number;
    form?: 'NONE' | 'EMPTY' | 'DEFAULT' | 'SQUARE' | 'CIRCLE' | 'LINE';
    formSize?: number;
    xEntrySpace?: number;
    yEntrySpace?: number;
    wordWrapEnabled?: boolean;
  }

  export interface AnimationConfig {
    durationX?: number;
    durationY?: number;
  }

  export interface BarChartProps {
    style?: ViewStyle;
    data: BarChartData;
    xAxis?: AxisConfig;
    yAxis?: YAxisConfig;
    chartDescription?: { text: string };
    legend?: LegendConfig;
    animation?: AnimationConfig;
    drawValueAboveBar?: boolean;
    highlightEnabled?: boolean;
    dragEnabled?: boolean;
    scaleEnabled?: boolean;
    scaleXEnabled?: boolean;
    scaleYEnabled?: boolean;
    pinchZoom?: boolean;
  }

  export class BarChart extends Component<BarChartProps> {}
}





