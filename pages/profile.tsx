import ProfilePage from "@/Components/Page/Profile/ProfilePage";
import { UserAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import useTokenData from "@/hooks/useTokenData";
import { pageProps, rootReducer } from "@/utils/types";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

const Profile = ({ setPageName, setPageDescription }: pageProps) => {
  const dispatch = useDispatch();
  const tokenData = useTokenData();
  const namespaces = ["profile", "common"];
  const { t } = useTranslation(namespaces);
  const tProfile = useCallback((key: string) => t(key, { ns: "profile" }), [t]);

  const userState = useSelector((state: rootReducer) => state.userReducer);
  const profile = userState.profile;

  useEffect(() => {
    dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch]);

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tProfile("profile"));
      setPageDescription("");
    }
  }, [setPageName, setPageDescription, tProfile]);

  // Merge profile API data with tokenData for a complete picture
  const mergedTokenData = tokenData
    ? {
        ...tokenData,
        ...(profile?.name && { name: profile.name }),
        ...(profile?.email && { email: profile.email }),
        ...(profile?.mobile && { mobile: profile.mobile }),
        ...(profile?.photo && { photo: profile.photo }),
      }
    : undefined;

  return <>{mergedTokenData && <ProfilePage tokenData={mergedTokenData} />}</>;
};

export default Profile;
