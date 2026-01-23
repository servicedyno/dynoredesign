const getErrorMessage = (e: any) => {
  return (
    e?.response?.data?.error?.message ??
    e?.response?.data?.message ??
    e?.message ??
    "Internal Server Error"
  );
};

export default getErrorMessage;
