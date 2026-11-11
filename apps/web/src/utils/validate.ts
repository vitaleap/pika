export const onlyAllowNumber = (value: string) => !value || /^\d+$/.test(value)
