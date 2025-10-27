declare module 'react-native-qrcode-svg' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  export interface QRCodeProps extends ViewProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    logo?: any;
    logoSize?: number;
    logoMargin?: number;
    logoBorderRadius?: number;
    logoBackgroundColor?: string;
  }

  export default class QRCode extends Component<QRCodeProps> {}
}
