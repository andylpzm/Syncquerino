// navigation parameter types for static type checking across the screens
import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Groceries: undefined;
  Reminders: undefined;
  Notes: undefined;
};

export type RootStackParamList = {
  GroupSelect: undefined;
  MainTabs: undefined;
  GroupSettings: undefined;
};
