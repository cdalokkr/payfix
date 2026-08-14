export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  country: string;
  companyName: string;
  workspaceDisplayName: string;
  workspaceName: string;
  industry: string;
  teamSize: string;
  password: string;
  confirmPassword: string;
}

export const initialRegisterData: RegisterFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  countryCode: "+91",
  country: "IN",
  companyName: "",
  workspaceDisplayName: "",
  workspaceName: "",
  industry: "",
  teamSize: "",
  password: "",
  confirmPassword: "",
};
