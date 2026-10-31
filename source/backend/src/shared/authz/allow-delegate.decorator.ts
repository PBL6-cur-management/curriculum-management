import { SetMetadata } from '@nestjs/common';

export const ALLOW_DELEGATE_KEY = 'allowDelegate';

// F-25 (D2): a route a delegate may reach without the permission itself, while a grant to them is usable today.
// It opens the door only; the service still limits them to the requests the grant covers.
export const AllowDelegate = () => SetMetadata(ALLOW_DELEGATE_KEY, true);
