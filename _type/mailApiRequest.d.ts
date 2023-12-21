export type MailApiRequest = {
    from?: string;
    title: string;
    msg: {
        sig: {
            name: string;
        };
        user: {
            name: string;
            identity: string;
            class: string;
            email: string;
        };
        question: {
            q1: string;
            q2: string;
            q3: string;
        };
        confirmId: string;
    };
    to: string[];
};
